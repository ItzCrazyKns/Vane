import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { TextBlock } from '@/lib/types';

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    try {
      const exists = await db.query.messages.findFirst({
        where: and(
          eq(messages.chatId, input.chatId),
          eq(messages.messageId, input.messageId),
        ),
      });

      if (!exists) {
        await db.insert(messages).values({
          chatId: input.chatId,
          messageId: input.messageId,
          backendId: session.id,
          query: input.followUp,
          createdAt: new Date().toISOString(),
          status: 'answering',
          responseBlocks: [],
        });
      } else {
        await db
          .delete(messages)
          .where(
            and(eq(messages.chatId, input.chatId), gt(messages.id, exists.id)),
          )
          .execute();
        await db
          .update(messages)
          .set({
            status: 'answering',
            backendId: session.id,
            responseBlocks: [],
          })
          .where(
            and(
              eq(messages.chatId, input.chatId),
              eq(messages.messageId, input.messageId),
            ),
          )
          .execute();
      }

      const classification = await classify({
        chatHistory: input.chatHistory,
        enabledSources: input.config.sources,
        query: input.followUp,
        llm: input.config.llm,
      });

      const widgetPromise = WidgetExecutor.executeAll({
        classification,
        chatHistory: input.chatHistory,
        followUp: input.followUp,
        llm: input.config.llm,
      }).then((widgetOutputs) => {
        widgetOutputs.forEach((o) => {
          session.emitBlock({
            id: crypto.randomUUID(),
            type: 'widget',
            data: {
              widgetType: o.type,
              params: o.data,
            },
          });
        });
        return widgetOutputs;
      });

      let searchPromise: Promise<ResearcherOutput> | null = null;

      if (!classification.classification.skipSearch) {
        const researcher = new Researcher();
        searchPromise = researcher.research(session, {
          chatHistory: input.chatHistory,
          followUp: input.followUp,
          classification: classification,
          config: input.config,
        });
      }

      const [widgetOutputs, searchResults] = await Promise.all([
        widgetPromise,
        searchPromise,
      ]);

      session.emit('data', {
        type: 'researchComplete',
      });

      const finalContext =
        searchResults?.searchFindings
          .map(
            (f, index) =>
              `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`,
          )
          .join('\n') || '';

      const widgetContext = widgetOutputs
        .map((o) => {
          return `<result>${o.llmContext}</result>`;
        })
        .join('\n-------------\n');

      const finalContextWithWidgets = `<search_results note="These are the search results and assistant can cite these">\n${finalContext}\n</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, assistant can use this information to answer the query but do not CITE this as a souce">\n${widgetContext}\n</widgets_result>`;

      const writerPrompt = getWriterPrompt(
        finalContextWithWidgets,
        input.config.systemInstructions,
        input.config.mode,
      );
      const answerStream = input.config.llm.streamText({
        messages: [
          {
            role: 'system',
            content: writerPrompt,
          },
          ...input.chatHistory,
          {
            role: 'user',
            content: input.followUp,
          },
        ],
      });

      let responseBlockId = '';

      for await (const chunk of answerStream) {
        if (!responseBlockId) {
          const block: TextBlock = {
            id: crypto.randomUUID(),
            type: 'text',
            data: chunk.contentChunk,
          };

          session.emitBlock(block);

          responseBlockId = block.id;
        } else {
          const block = session.getBlock(responseBlockId) as TextBlock | null;

          if (!block) {
            continue;
          }

          block.data += chunk.contentChunk;

          session.updateBlock(block.id, [
            {
              op: 'replace',
              path: '/data',
              value: block.data,
            },
          ]);
        }
      }

      session.emit('end', {});

      await db
        .update(messages)
        .set({
          status: 'completed',
          responseBlocks: session.getAllBlocks(),
        })
        .where(
          and(
            eq(messages.chatId, input.chatId),
            eq(messages.messageId, input.messageId),
          ),
        )
        .execute();
    } catch (error) {
      console.error('Error while running search:', error);
      session.emit('error', {
        data: error instanceof Error ? error.message : 'Search failed',
      });

      try {
        await db
          .update(messages)
          .set({
            status: 'error',
            responseBlocks: session.getAllBlocks(),
          })
          .where(
            and(
              eq(messages.chatId, input.chatId),
              eq(messages.messageId, input.messageId),
            ),
          )
          .execute();
      } catch (dbError) {
        console.error('Failed to persist errored search state:', dbError);
      }
    }
  }
}

export default SearchAgent;

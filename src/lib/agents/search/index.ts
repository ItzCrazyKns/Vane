import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { and, desc, eq, gt } from 'drizzle-orm';
import { TextBlock } from '@/lib/types';
import { getTokenCount } from '@/lib/utils/splitText';
import UploadManager from '@/lib/uploads/manager';

export class ChatRewriteConflict extends Error {
  constructor() {
    super(
      'This conversation changed while rewriting. Reload it and try again.',
    );
  }
}

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    const chatMessages = eq(messages.chatId, input.chatId);
    const targetMessage = and(
      chatMessages,
      eq(messages.messageId, input.messageId),
    );
    const findTarget = (database: Pick<typeof db, 'query'>) =>
      database.query.messages
        .findFirst({
          where: targetMessage,
          columns: { id: true, backendId: true },
        })
        .sync();
    const findTail = (database: Pick<typeof db, 'query'>) =>
      database.query.messages
        .findFirst({
          where: chatMessages,
          orderBy: desc(messages.id),
          columns: { id: true, backendId: true },
        })
        .sync();

    const { exists, expectedTail } = db.transaction(
      (tx) => {
        const exists = findTarget(tx);
        const expectedTail =
          exists && input.config.uploads ? findTail(tx) : undefined;

        const createdAt = new Date().toISOString();
        if (!exists) {
          tx.insert(messages)
            .values({
              chatId: input.chatId,
              messageId: input.messageId,
              backendId: session.id,
              query: input.followUp,
              createdAt,
              status: 'answering',
              responseBlocks: [],
            })
            .run();
        }

        // Publish the chat with its first pending message so another request
        // cannot roll it back before the message is saved.
        const chat = tx.query.chats
          .findFirst({
            where: eq(chats.id, input.chatId),
            columns: { id: true },
          })
          .sync();
        if (!chat) {
          tx.insert(chats)
            .values({
              id: input.chatId,
              createdAt,
              sources: input.config.sources,
              title: input.followUp,
              files: input.config.fileIds.map((fileId) => ({
                fileId,
                name: UploadManager.getFile(fileId)?.name || 'Uploaded File',
              })),
            })
            .run();
        }

        return { exists, expectedTail };
      },
      { behavior: 'immediate' },
    );

    const startRewrite = (id: number) => {
      db.transaction((tx) => {
        if (input.config.uploads) {
          const currentTarget = findTarget(tx);
          const currentTail = findTail(tx);
          if (
            !expectedTail ||
            currentTarget?.id !== id ||
            currentTarget.backendId !== exists?.backendId ||
            currentTail?.id !== expectedTail.id ||
            currentTail.backendId !== expectedTail.backendId
          ) {
            throw new ChatRewriteConflict();
          }
        }
        tx.delete(messages)
          .where(and(chatMessages, gt(messages.id, id)))
          .run();
        tx.update(messages)
          .set({
            status: 'answering',
            backendId: session.id,
            responseBlocks: [],
          })
          .where(eq(messages.id, id))
          .run();
      });
    };

    if (exists && !input.config.uploads) {
      startRewrite(exists.id);
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

    // A dimension change may only surface once the provider embeds a search query.
    if (exists && input.config.uploads) startRewrite(exists.id);

    session.emit('data', {
      type: 'researchComplete',
    });

    let finalContext =
      '<Query to be answered without searching; Search not made>';

    if (searchResults) {
      finalContext = searchResults?.searchFindings
        .map(
          (f, index) =>
            `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`,
        )
        .join('\n');
    }

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

    await db
      .update(messages)
      .set({
        status: 'completed',
        responseBlocks: session.getAllBlocks(),
      })
      .where(and(targetMessage, eq(messages.backendId, session.id)))
      .execute();

    session.emit('end', {});
  }
}

export default SearchAgent;

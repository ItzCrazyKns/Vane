import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import { fitWriterSources, formatSearchResult } from './writerContext';
import db from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { Message, TextBlock } from '@/lib/types';
import { getTokenCount } from '@/lib/utils/splitText';
import { sanitizeCitations } from '@/lib/utils/citations';

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    try {
      await this._searchAsync(session, input);
    } catch (err) {
      console.error('SearchAgent error:', err);
      session.emit('error', {
        data:
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during search',
      });
      await this.saveFailure(session, input);
    }
  }

  /* Persists the error status and the blocks produced so far, so a failed
     answer does not stay 'answering' forever in the chat history. */
  private async saveFailure(session: SessionManager, input: SearchAgentInput) {
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
    } catch (dbErr) {
      console.error('SearchAgent: failed to save error status:', dbErr);
    }
  }

  private async _searchAsync(session: SessionManager, input: SearchAgentInput) {
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

    const widgetContext = widgetOutputs
      .map((o) => {
        return `<result>${o.llmContext}</result>`;
      })
      .join('\n-------------\n');

    const wrapContext = (results: string) =>
      `<search_results note="These are the search results and assistant can cite these">\n${results}\n</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, assistant can use this information to answer the query but do not CITE this as a souce">\n${widgetContext}\n</widgets_result>`;

    const writerMessages: Message[] = [
      ...input.chatHistory,
      {
        role: 'user',
        content: input.followUp,
      },
    ];

    let finalContext =
      '<Query to be answered without searching; Search not made>';

    /* Sources the writer is given; it can only cite [1]..[n] of them. */
    let writerSourceCount: number | null = null;

    if (searchResults) {
      const findings = await fitWriterSources({
        findings: searchResults.searchFindings,
        llm: input.config.llm,
        mode: input.config.mode,
        promptWithoutSources: getWriterPrompt(
          wrapContext(''),
          input.config.systemInstructions,
          input.config.mode,
          classification.classification.skipSearch,
        ),
        messages: writerMessages,
      });

      finalContext = findings.map(formatSearchResult).join('\n');
      writerSourceCount = findings.length;
    }

    const finalContextWithWidgets = wrapContext(finalContext);

    const writerPrompt = getWriterPrompt(
      finalContextWithWidgets,
      input.config.systemInstructions,
      input.config.mode,
      classification.classification.skipSearch,
    );

    const answerStream = input.config.llm.streamText({
      messages: [
        {
          role: 'system',
          content: writerPrompt,
        },
        ...writerMessages,
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

    /* Drop [n] above the sources the writer saw (upstream #1227): the UI
       would link them to a source it never read, or to nothing. */
    const answer = session.getBlock(responseBlockId) as TextBlock | null;
    if (answer && writerSourceCount !== null) {
      const cleaned = sanitizeCitations(answer.data, writerSourceCount);
      if (cleaned !== answer.data) {
        answer.data = cleaned;
        session.updateBlock(answer.id, [
          { op: 'replace', path: '/data', value: cleaned },
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
  }
}

export default SearchAgent;

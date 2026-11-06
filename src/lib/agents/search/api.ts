import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import { fitWriterSources, formatSearchResult } from './writerContext';
import { Message } from '@/lib/types';

class APISearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    try {
      await this._searchAsync(session, input);
    } catch (err) {
      console.error('APISearchAgent error:', err);
      session.emit('error', {
        data:
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during search',
      });
    }
  }

  private async _searchAsync(session: SessionManager, input: SearchAgentInput) {
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
    }).catch((err) => {
      console.error(`Error executing widgets: ${err}`);
      return [];
    });

    let searchPromise: Promise<ResearcherOutput> | null = null;

    if (!classification.classification.skipSearch) {
      const researcher = new Researcher();
      searchPromise = researcher.research(SessionManager.createSession(), {
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

    if (searchResults) {
      session.emit('data', {
        type: 'searchResults',
        data: searchResults.searchFindings,
      });
    }

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

    let finalContext = '';

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

    for await (const chunk of answerStream) {
      session.emit('data', {
        type: 'response',
        data: chunk.contentChunk,
      });
    }

    session.emit('end', {});
  }
}

export default APISearchAgent;

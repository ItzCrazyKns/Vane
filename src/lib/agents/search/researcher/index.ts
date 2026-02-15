import {
  ActionOutput,
  ResearcherInput,
  ResearcherOutput,
  SearchFinding,
} from '../types';
import { ActionRegistry } from './actions';
import { getResearcherPrompt } from '@/lib/prompts/search/researcher';
import SessionManager from '@/lib/session';
import { Message, ReasoningResearchBlock, Chunk } from '@/lib/types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { ToolCall } from '@/lib/models/types';

class Researcher {
  async research(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    const researchStartTime = Date.now();
    let actionOutput: ActionOutput[] = [];
    let maxIteration =
      input.config.mode === 'speed'
        ? 2
        : input.config.mode === 'balanced'
          ? 6
          : 10; // Reduced from 25 to 10 for better performance

    const availableTools = ActionRegistry.getAvailableActionTools({
      classification: input.classification,
      fileIds: input.config.fileIds,
      mode: input.config.mode,
      sources: input.config.sources,
    });

    const availableActionsDescription =
      ActionRegistry.getAvailableActionsDescriptions({
        classification: input.classification,
        fileIds: input.config.fileIds,
        mode: input.config.mode,
        sources: input.config.sources,
      });

    const researchBlockId = crypto.randomUUID();

    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: {
        subSteps: [],
      },
    });

    const agentMessageHistory: Message[] = [
      {
        role: 'user',
        content: `
          <conversation>
          ${formatChatHistoryAsString(input.chatHistory.slice(-10))}
           User: ${input.followUp} (Standalone question: ${input.classification.standaloneFollowUp})
           </conversation>
        `,
      },
    ];

    for (let i = 0; i < maxIteration; i++) {
      const iterationStartTime = Date.now();
      console.log(
        `\n🔄 Research iteration ${i + 1}/${maxIteration} [${input.config.mode} mode]`,
      );

      const researcherPrompt = getResearcherPrompt(
        availableActionsDescription,
        input.config.mode,
        i,
        maxIteration,
        input.config.fileIds,
      );

      const llmStartTime = Date.now();
      const actionStream = input.config.llm.streamText({
        messages: [
          {
            role: 'system',
            content: researcherPrompt,
          },
          ...agentMessageHistory,
        ],
        tools: availableTools,
      });

      const block = session.getBlock(researchBlockId);

      let reasoningEmitted = false;
      let reasoningId = crypto.randomUUID();

      let finalToolCalls: ToolCall[] = [];

      for await (const partialRes of actionStream) {
        if (partialRes.toolCallChunk.length > 0) {
          partialRes.toolCallChunk.forEach((tc) => {
            if (
              tc.name === '__reasoning_preamble' &&
              tc.arguments['plan'] &&
              !reasoningEmitted &&
              block &&
              block.type === 'research'
            ) {
              reasoningEmitted = true;

              block.data.subSteps.push({
                id: reasoningId,
                type: 'reasoning',
                reasoning: tc.arguments['plan'],
              });

              session.updateBlock(researchBlockId, [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: block.data.subSteps,
                },
              ]);
            } else if (
              tc.name === '__reasoning_preamble' &&
              tc.arguments['plan'] &&
              reasoningEmitted &&
              block &&
              block.type === 'research'
            ) {
              const subStepIndex = block.data.subSteps.findIndex(
                (step: any) => step.id === reasoningId,
              );

              if (subStepIndex !== -1) {
                const subStep = block.data.subSteps[
                  subStepIndex
                ] as ReasoningResearchBlock;
                subStep.reasoning = tc.arguments['plan'];
                session.updateBlock(researchBlockId, [
                  {
                    op: 'replace',
                    path: '/data/subSteps',
                    value: block.data.subSteps,
                  },
                ]);
              }
            }

            // Enhanced query normalization to handle stringified arrays
            const rawQueries = tc.arguments?.queries;
            let normalizedQueries: string[] = [];

            if (Array.isArray(rawQueries)) {
              normalizedQueries = rawQueries;
            } else if (typeof rawQueries === 'string') {
              const queryString = rawQueries as string;
              const trimmedStr = queryString.trim();
              if (trimmedStr.startsWith('[') && trimmedStr.endsWith(']')) {
                try {
                  const jsonStr = trimmedStr.replace(/'/g, '"');
                  const parsed = JSON.parse(jsonStr);
                  if (Array.isArray(parsed)) {
                    normalizedQueries = parsed;
                  } else {
                    normalizedQueries = [trimmedStr];
                  }
                } catch (e) {
                  normalizedQueries = [trimmedStr];
                }
              } else {
                normalizedQueries = [trimmedStr];
              }
            }

            const normalizedArguments = {
              ...tc.arguments,
              queries: normalizedQueries,
            };

            const existingIndex = finalToolCalls.findIndex(
              (ftc) => ftc.id === tc.id,
            );

            if (existingIndex !== -1) {
              finalToolCalls[existingIndex].arguments = normalizedArguments;
            } else {
              finalToolCalls.push({
                id: tc.id,
                name: tc.name,
                arguments: normalizedArguments,
              });
            }
          });
        }
      }

      const llmDuration = Date.now() - llmStartTime;
      console.log(`⏱️ LLM streaming completed in ${llmDuration}ms`);

      if (finalToolCalls.length === 0) {
        console.log('⚠️ No tool calls received from LLM, ending research');
        break;
      }

      if (finalToolCalls[finalToolCalls.length - 1].name === 'done') {
        console.log('✅ LLM signaled done, ending research');
        break;
      }

      console.log(
        `🛠️ Executing ${finalToolCalls.length} tool calls: ${finalToolCalls.map((tc) => tc.name).join(', ')}`,
      );

      agentMessageHistory.push({
        role: 'assistant',
        content: '',
        tool_calls: finalToolCalls,
      });

      const actionStartTime = Date.now();
      const actionResults = await ActionRegistry.executeAll(finalToolCalls, {
        llm: input.config.llm,
        embedding: input.config.embedding,
        session: session,
        researchBlockId: researchBlockId,
        fileIds: input.config.fileIds,
      });
      const actionDuration = Date.now() - actionStartTime;
      console.log(`⏱️ Actions executed in ${actionDuration}ms`);

      actionOutput.push(...actionResults);

      actionResults.forEach((action, i) => {
        agentMessageHistory.push({
          role: 'tool',
          id: finalToolCalls[i].id,
          name: finalToolCalls[i].name,
          content: JSON.stringify(action),
        });
      });

      const iterationDuration = Date.now() - iterationStartTime;
      console.log(
        `⏱️ Iteration ${i + 1} completed in ${iterationDuration}ms\n`,
      );

      // Early termination: if this iteration had searches but returned no results, stop
      const hasSearchActions = actionResults.some(
        (a) => a.type === 'search_results',
      );
      const hasEmptyResults = actionResults.every(
        (a) =>
          a.type !== 'search_results' ||
          (a.type === 'search_results' && a.results.length === 0),
      );

      if (hasSearchActions && hasEmptyResults && i > 0) {
        console.log('⚠️ Search returned no results, ending research early');
        break;
      }
    }

    const searchResults = actionOutput
      .filter((a) => a.type === 'search_results')
      .flatMap((a) => a.results);

    const seenUrls = new Map<string, number>();

    const processedChunks = searchResults
      .map((result, index) => {
        if (result.metadata.url && !seenUrls.has(result.metadata.url)) {
          seenUrls.set(result.metadata.url, index);
          return result;
        } else if (result.metadata.url && seenUrls.has(result.metadata.url)) {
          const existingIndex = seenUrls.get(result.metadata.url)!;
          const existingResult = searchResults[existingIndex];
          existingResult.content += `\n\n${result.content}`;
          return undefined;
        }
        return result;
      })
      .filter((r): r is Chunk => r !== undefined);

    const searchFindings: SearchFinding[] = processedChunks.map((chunk) => ({
      title: chunk.metadata.title || 'No title',
      url: chunk.metadata.url || '',
      chunk,
    }));

    session.emitBlock({
      id: crypto.randomUUID(),
      type: 'source',
      data: processedChunks,
    });

    const totalDuration = Date.now() - researchStartTime;
    const searchActions = actionOutput.filter(
      (a) => a.type === 'search_results',
    );
    const totalResults = searchActions.reduce(
      (sum, a) => sum + (a.results?.length || 0),
      0,
    );

    console.log(`\n✅ Research completed in ${totalDuration}ms`);
    console.log(
      `   - Total iterations: ${Math.min(maxIteration, actionOutput.length + 1)}`,
    );
    console.log(`   - Total search results: ${totalResults}`);
    console.log(
      `   - Results per search: ${searchActions.length > 0 ? (totalResults / searchActions.length).toFixed(1) : 0}\n`,
    );

    return {
      findings: actionOutput,
      searchFindings,
    };
  }
}

export default Researcher;

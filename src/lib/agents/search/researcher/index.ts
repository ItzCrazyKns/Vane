import { ActionOutput, ResearcherInput, ResearcherOutput } from '../types';
import { trace } from '@/lib/trace';
import { ActionRegistry } from './actions';
import { getResearcherPrompt } from '@/lib/prompts/search/researcher';
import SessionManager from '@/lib/session';
import { Chunk, Message, ReasoningResearchBlock } from '@/lib/types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { ToolCall } from '@/lib/models/types';
import { syncMCPActions } from './actions/mcp';
import {
  RESERVED_OUTPUT_TOKENS,
  computeBudget,
  estimateTokens,
  getContextWindow,
} from '@/lib/context/budget';
import { compactResearchHistory } from '@/lib/context/compact';

/**
 * Sent back as the result of `done` when the research has found no source
 * at all, so the model searches once more instead of answering blind.
 */
export const NO_EVIDENCE_NOTE =
  'No sources were found yet, so the answer would have nothing to cite. Before finishing, search again once with broader or differently worded queries (and without recency/domain filters). Call done only if that search also finds nothing.';

/** Rough per-tool cost of the tool schema sent with each request. */
const TOOL_SCHEMA_OVERHEAD_TOKENS = 60;

/**
 * The search results of a research, one entry per URL in first-seen order.
 * A URL found again adds its content to the first entry. Works on copies,
 * so it can run after every step without appending the same text twice.
 */
export const mergeSearchFindings = (actionOutput: ActionOutput[]): Chunk[] => {
  const merged: Chunk[] = [];
  const byUrl = new Map<string, Chunk>();

  for (const action of actionOutput) {
    if (action.type !== 'search_results') continue;
    for (const result of action.results) {
      const url = result.metadata?.url;
      if (!url) {
        merged.push(result);
        continue;
      }
      const existing = byUrl.get(url);
      if (existing) {
        existing.content += `\n\n${result.content}`;
        continue;
      }
      const copy: Chunk = { ...result, metadata: { ...result.metadata } };
      byUrl.set(url, copy);
      merged.push(copy);
    }
  }

  return merged;
};

class Researcher {
  async research(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    let actionOutput: ActionOutput[] = [];
    let maxIteration =
      input.config.mode === 'speed'
        ? 2
        : input.config.mode === 'balanced'
          ? 6
          : 25;

    await syncMCPActions();

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

    /* The model gets one extra search when it tries to finish with no
       sources at all (weak evidence), if a web search is available. */
    let retriedForEvidence = false;
    const canSearchWeb = availableTools.some((t) => t.name === 'web_search');

    /* One source block per answer, emitted with the first results and
       replaced as the research finds more. */
    const sourceBlockId = crypto.randomUUID();
    let sourceBlockEmitted = false;

    const publishSources = (final: boolean): Chunk[] => {
      const data = mergeSearchFindings(actionOutput);

      if (!sourceBlockEmitted) {
        if (data.length === 0 && !final) return data;
        session.emitBlock({ id: sourceBlockId, type: 'source', data });
        sourceBlockEmitted = true;
      } else {
        session.updateBlock(sourceBlockId, [
          { op: 'replace', path: '/data', value: data },
        ]);
      }

      return data;
    };

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

    const researcherBudget = computeBudget(
      await getContextWindow(input.config.llm),
      RESERVED_OUTPUT_TOKENS.researcher,
    );

    for (let i = 0; i < maxIteration; i++) {
      const researcherPrompt = getResearcherPrompt(
        availableActionsDescription,
        input.config.mode,
        i,
        maxIteration,
        input.config.fileIds,
      );

      const fixedTokens =
        estimateTokens(researcherPrompt) +
        availableTools.reduce(
          (sum, t) =>
            sum +
            estimateTokens(`${t.name} ${t.description}`) +
            TOOL_SCHEMA_OVERHEAD_TOKENS,
          0,
        );

      const compaction = compactResearchHistory(
        agentMessageHistory,
        researcherBudget,
        fixedTokens,
      );

      if (compaction.report.cleared > 0 || compaction.report.truncated > 0) {
        agentMessageHistory.splice(
          0,
          agentMessageHistory.length,
          ...compaction.history,
        );
        console.log(
          `[context] researcher history compacted: ~${compaction.report.before} -> ~${compaction.report.after} tokens (budget ${researcherBudget}; ${compaction.report.cleared} result(s) cleared, ${compaction.report.truncated} truncated)`,
        );
      }

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

            const existingIndex = finalToolCalls.findIndex(
              (ftc) => ftc.id === tc.id,
            );

            if (existingIndex !== -1) {
              finalToolCalls[existingIndex].arguments = tc.arguments;
            } else {
              finalToolCalls.push(tc);
            }
          });
        }
      }

      if (finalToolCalls.length === 0) {
        break;
      }

      trace({
        type: 'research_iteration',
        iteration: i,
        actions: finalToolCalls.map((tc) => tc.name),
      });

      const actionConfig = {
        llm: input.config.llm,
        embedding: input.config.embedding,
        session: session,
        researchBlockId: researchBlockId,
        fileIds: input.config.fileIds,
        mode: input.config.mode,
        question:
          input.classification.standaloneFollowUp?.trim() || input.followUp,
      };

      if (finalToolCalls.some((tc) => tc.name === 'done')) {
        /* Small models often send a last search together with done. Run
           those calls so their results reach the answer, then stop. */
        const remaining = finalToolCalls.filter(
          (tc) => tc.name !== 'done' && tc.name !== '__reasoning_preamble',
        );

        const remainingResults =
          remaining.length > 0
            ? await ActionRegistry.executeAll(remaining, actionConfig)
            : [];
        actionOutput.push(...remainingResults);

        const noEvidence =
          canSearchWeb &&
          !retriedForEvidence &&
          i < maxIteration - 1 &&
          mergeSearchFindings(actionOutput).length === 0;

        if (!noEvidence) break;

        retriedForEvidence = true;
        console.log(
          '[research] done called with no sources; asking for one more search',
        );

        publishSources(false);

        agentMessageHistory.push({
          role: 'assistant',
          content: '',
          tool_calls: finalToolCalls,
        });

        finalToolCalls.forEach((tc) => {
          const k = remaining.indexOf(tc);
          agentMessageHistory.push({
            role: 'tool',
            id: tc.id,
            name: tc.name,
            content:
              tc.name === 'done'
                ? JSON.stringify({ type: 'done', note: NO_EVIDENCE_NOTE })
                : k !== -1
                  ? JSON.stringify(remainingResults[k])
                  : JSON.stringify({
                      type: 'reasoning',
                      reasoning: tc.arguments?.plan ?? '',
                    }),
          });
        });

        continue;
      }

      agentMessageHistory.push({
        role: 'assistant',
        content: '',
        tool_calls: finalToolCalls,
      });

      const actionResults = await ActionRegistry.executeAll(
        finalToolCalls,
        actionConfig,
      );

      actionOutput.push(...actionResults);

      /* Show the sources found so far right away, as Perplexity streams
         search results before the answer, instead of only at the end. */
      publishSources(false);

      actionResults.forEach((action, i) => {
        agentMessageHistory.push({
          role: 'tool',
          id: finalToolCalls[i].id,
          name: finalToolCalls[i].name,
          content: JSON.stringify(action),
        });
      });
    }

    /* Final, deduplicated source list: the one the writer cites. Emitted
       even when empty, as before. */
    const filteredSearchResults = publishSources(true);

    return {
      findings: actionOutput,
      searchFindings: filteredSearchResults,
    };
  }
}

export default Researcher;

import type BaseLLM from '@/lib/models/base/llm';
import type { Chunk, Message } from '@/lib/types';
import {
  RESERVED_OUTPUT_TOKENS,
  computeBudget,
  estimateMessagesTokens,
  estimateTokens,
  getContextWindow,
} from '@/lib/context/budget';
import { fitSourcesToBudget } from '@/lib/context/compact';
import type { SearchAgentConfig } from './types';

export const formatSearchResult = (f: Chunk, index: number) =>
  `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`;

/**
 * Cuts the writer's sources down to what fits in the context window next
 * to the writer prompt, the chat history and the reserved answer.
 * `promptWithoutSources` is the system prompt as it would be sent with an
 * empty source list. Order is kept, so citation numbers stay valid.
 */
export const fitWriterSources = async (input: {
  findings: Chunk[];
  llm: BaseLLM<any>;
  mode: SearchAgentConfig['mode'];
  promptWithoutSources: string;
  messages: Message[];
}): Promise<Chunk[]> => {
  if (input.findings.length === 0) return input.findings;

  const budget = computeBudget(
    await getContextWindow(input.llm),
    RESERVED_OUTPUT_TOKENS.writer[input.mode],
  );
  const used =
    estimateTokens(input.promptWithoutSources) +
    estimateMessagesTokens(input.messages);

  const fitted = fitSourcesToBudget(
    input.findings,
    Math.max(0, budget - used),
    formatSearchResult,
  );

  if (fitted.dropped > 0 || fitted.truncated > 0) {
    console.log(
      `[context] writer sources fitted to ~${Math.max(0, budget - used)} tokens: ${fitted.sources.length}/${input.findings.length} kept, ${fitted.truncated} truncated`,
    );
  }

  return fitted.sources;
};

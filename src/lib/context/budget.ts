import type BaseLLM from '@/lib/models/base/llm';
import type { Message } from '@/lib/types';
import { getTokenCount } from '@/lib/utils/splitText';

/** Used when neither LLM_CONTEXT_WINDOW nor the provider says otherwise. */
export const DEFAULT_CONTEXT_WINDOW = 32000;

/**
 * Token counts come from cl100k (js-tiktoken). Local models such as Qwen
 * use other tokenizers and Portuguese text costs more tokens, so estimates
 * are inflated by this factor to stay on the safe side.
 */
export const TOKEN_SAFETY_FACTOR = 1.2;

/** Fixed per-message overhead (role markers, separators) in tokens. */
const MESSAGE_OVERHEAD_TOKENS = 4;

/** Share of the window kept free on top of the reserved output. */
export const DEFAULT_MARGIN = 0.1;

/** Tokens kept free for the model's answer, by stage and mode. */
export const RESERVED_OUTPUT_TOKENS = {
  researcher: 4000,
  writer: { speed: 3000, balanced: 4000, quality: 6000 },
} as const;

const parseWindow = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * Context window to plan against, in tokens. LLM_CONTEXT_WINDOW wins so
 * the user can always correct it; then whatever the provider reports
 * (Ollama's num_ctx, LM Studio's loaded context); then 32k.
 */
export const getContextWindow = async (
  llm: Pick<BaseLLM<any>, 'getContextWindow'>,
): Promise<number> => {
  const fromEnv = parseWindow(process.env.LLM_CONTEXT_WINDOW);
  if (fromEnv) return fromEnv;

  try {
    const fromProvider = await llm.getContextWindow?.();
    if (fromProvider && fromProvider > 0) return fromProvider;
  } catch {
    /* fall through to the default */
  }

  return DEFAULT_CONTEXT_WINDOW;
};

/** Estimated tokens of a piece of text, already inflated by the safety factor. */
export const estimateTokens = (text: string): number =>
  Math.ceil(getTokenCount(text) * TOKEN_SAFETY_FACTOR);

/** Estimated prompt tokens for a list of chat messages. */
export const estimateMessagesTokens = (messages: Message[]): number =>
  messages.reduce((total, m) => {
    let text = m.content ?? '';
    if (m.role === 'assistant' && m.tool_calls?.length) {
      text += JSON.stringify(m.tool_calls);
    }
    return total + estimateTokens(text) + MESSAGE_OVERHEAD_TOKENS;
  }, 0);

/**
 * Tokens available for the prompt: the window minus the answer we reserve
 * and a safety margin. Never negative.
 */
export const computeBudget = (
  contextWindow: number,
  reservedOutput: number,
  margin = DEFAULT_MARGIN,
): number =>
  Math.max(0, Math.floor(contextWindow * (1 - margin) - reservedOutput));

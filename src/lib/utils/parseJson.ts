/**
 * Strips markdown code fences that some LLM providers (Claude, models via
 * LiteLLM/OpenRouter) wrap around JSON output.
 *
 * Handles ```json ... ```, ``` ... ```, and raw JSON (no-op).
 */
export function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Strips markdown code fences from LLM output before JSON.parse.
 * Fixes issue #959: Claude/LiteLLM models wrap JSON in markdown blocks.
 */
export function safeParseJson<T>(text: string): T {
  return JSON.parse(stripMarkdownFences(text)) as T;
}

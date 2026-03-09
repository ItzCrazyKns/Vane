/**
 * Utilities for parsing JSON from LLM responses.
 *
 * Many LLMs (especially when accessed via OpenAI-compatible APIs like OpenRouter,
 * LiteLLM, etc.) wrap JSON responses in markdown code fences even when
 * response_format is set to json_object. These utilities help handle such cases.
 */

/**
 * Strip markdown code fences from a string.
 * Handles both ```json and plain ``` fences.
 *
 * @example
 * stripMarkdownFences('```json\n{"foo": "bar"}\n```') // '{"foo": "bar"}'
 * stripMarkdownFences('{"foo": "bar"}') // '{"foo": "bar"}'
 */
export function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return trimmed;
}

/**
 * Safely parse JSON, stripping markdown fences first.
 * Returns undefined if parsing fails instead of throwing.
 *
 * @example
 * safeParseJson('```json\n{"foo": "bar"}\n```') // { foo: 'bar' }
 * safeParseJson('invalid') // undefined
 */
export function safeParseJson<T = unknown>(text: string): T | undefined {
  try {
    const cleaned = stripMarkdownFences(text);
    return JSON.parse(cleaned) as T;
  } catch {
    return undefined;
  }
}

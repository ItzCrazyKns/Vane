import { repairJson } from '@toolsycc/json-repair';

const FENCE = /```[a-zA-Z0-9_-]*[ \t]*\r?\n?([\s\S]*?)\r?\n?[ \t]*```/;

/**
 * Removes a markdown code fence around a JSON answer (```json ... ```), as
 * some models send even when asked for structured output (Claude through
 * LiteLLM or OpenRouter, upstream issue #959). Text without a fence is
 * returned unchanged.
 */
export const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  /* Bare JSON is left alone, even if a string inside it contains ```. */
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;

  const match = trimmed.match(FENCE);
  return match ? match[1].trim() : trimmed;
};

/** Parses a model's JSON answer: strips fences, then repairs and parses. */
export const parseModelJson = (text: string): unknown =>
  JSON.parse(
    repairJson(stripCodeFences(text), { extractJson: true }) as string,
  );

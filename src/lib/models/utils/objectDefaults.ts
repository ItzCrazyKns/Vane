/**
 * Sampling defaults for generateObject, the structured JSON steps
 * (classifier, picker, extractor, widgets, suggestions, media). They apply
 * only when neither the caller nor the model config sets a value; streamed
 * text keeps each class's own default.
 *
 * - Temperature 0.2 instead of 1.0 (OpenAI-compatible) / 0.7 (Ollama): these
 *   steps want the most likely valid JSON, not variety.
 * - A token cap so a model stuck in a loop cannot generate JSON until the
 *   context is full. It counts thinking tokens on servers that mix them in
 *   (LM Studio, Ollama), hence the headroom over the < 1k tokens the JSON
 *   itself needs.
 *
 * LLM_OBJECT_TEMPERATURE and LLM_OBJECT_MAX_TOKENS override them
 * (LLM_OBJECT_MAX_TOKENS=0 removes the cap).
 */
export const DEFAULT_OBJECT_TEMPERATURE = 0.2;
export const DEFAULT_OBJECT_MAX_TOKENS = 8192;

const readNumber = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export const objectTemperature = (): number =>
  readNumber(process.env.LLM_OBJECT_TEMPERATURE) ?? DEFAULT_OBJECT_TEMPERATURE;

/** undefined means no cap. */
export const objectMaxTokens = (): number | undefined => {
  const n =
    readNumber(process.env.LLM_OBJECT_MAX_TOKENS) ?? DEFAULT_OBJECT_MAX_TOKENS;
  return n > 0 ? Math.floor(n) : undefined;
};

/**
 * OpenAI reasoning models (o1, o3, o4-mini, gpt-5*) only accept the default
 * temperature and count hidden reasoning in the token limit, so they keep
 * the previous behaviour: temperature 1 and no cap. Matches Bifrost-style
 * names such as "openai/gpt-5-mini" too.
 */
export const isOpenAIReasoningModel = (model: string): boolean =>
  /(^|\/)(o\d+(-|$)|gpt-5)/i.test(model);

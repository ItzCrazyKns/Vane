/**
 * Request timeout for chat-model calls, from LLM_TIMEOUT_MS (upstream #993).
 *
 * It bounds the wait for the response headers: for a streamed answer that is
 * the time to the first token (prompt processing included), for a
 * non-streamed call the whole generation. Once headers arrive the body is not
 * cut.
 *
 * The 5-minute default matches what Node's fetch already enforces (undici's
 * headersTimeout is 300 s), so it changes nothing by default; set a lower
 * value to fail fast against a hung server. Values above 300 s are still
 * capped by that undici limit.
 */
export const DEFAULT_LLM_TIMEOUT_MS = 5 * 60 * 1000;

export const llmTimeoutMs = (): number => {
  const raw = process.env.LLM_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_LLM_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LLM_TIMEOUT_MS;
};

/**
 * fetch that aborts if the response headers take longer than `ms`, keeping
 * any signal the caller passed (the Ollama client uses one for abort()).
 */
export const fetchWithHeadersTimeout =
  (ms: number): typeof fetch =>
  async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException(
            `LLM request timed out after ${ms} ms (LLM_TIMEOUT_MS)`,
            'TimeoutError',
          ),
        ),
      ms,
    );

    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort(outer.reason);
      else
        outer.addEventListener('abort', () => controller.abort(outer.reason), {
          once: true,
        });
    }

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

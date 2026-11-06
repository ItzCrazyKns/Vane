import OpenAILLM from '../openai/openaiLLM';

const LOOKUP_TIMEOUT_MS = 3000;

class LMStudioLLM extends OpenAILLM {
  private contextWindowLookup?: Promise<number | undefined>;

  /**
   * Asks LM Studio's REST API (`/api/v0/models/{model}`) for the context
   * length the model is loaded with, falling back to its maximum. Looked up
   * once per instance; any failure means "unknown".
   */
  async getContextWindow(): Promise<number | undefined> {
    if (!this.contextWindowLookup) {
      this.contextWindowLookup = this.lookupContextWindow();
    }
    return this.contextWindowLookup;
  }

  private async lookupContextWindow(): Promise<number | undefined> {
    try {
      const root = (this.config.baseURL || '')
        .replace(/\/+$/, '')
        .replace(/\/v1$/, '');
      if (!root) return undefined;

      const res = await fetch(
        `${root}/api/v0/models/${encodeURIComponent(this.config.model)}`,
        { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
      );
      if (!res.ok) return undefined;

      const body = (await res.json()) as {
        loaded_context_length?: number;
        max_context_length?: number;
      };
      const value = body.loaded_context_length ?? body.max_context_length;

      return typeof value === 'number' && value > 0 ? value : undefined;
    } catch {
      return undefined;
    }
  }
}

export default LMStudioLLM;

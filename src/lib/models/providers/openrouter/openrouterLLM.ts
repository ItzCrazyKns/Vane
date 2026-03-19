import OpenAI from 'openai';
import OpenAILLM from '../openai/openaiLLM';
import { GenerateOptions } from '../../types';

type OpenRouterConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  options?: GenerateOptions;
};

class OpenRouterLLM extends OpenAILLM {
  constructor(protected config: OpenRouterConfig) {
    // Inject custom fetch to add reasoning parameter to OpenRouter requests
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || 'https://openrouter.ai/api/v1',
      fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.body && typeof init.body === 'string') {
          try {
            const body = JSON.parse(init.body);
            if (this.reasoning) {
              body.reasoning = { effort: this.reasoning.effort };
            }
            init = { ...init, body: JSON.stringify(body) };
          } catch {
            // Not JSON, pass through
          }
        }
        return globalThis.fetch(url, init);
      },
    });
  }
}

export default OpenRouterLLM;

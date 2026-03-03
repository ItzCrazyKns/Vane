import OpenAI from 'openai';
import OpenAILLM from '../openai/openaiLLM';
import { GenerateOptions } from '../../types';

type VeniceLLMConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  options?: GenerateOptions;
};

class VeniceLLM extends OpenAILLM {
  constructor(config: VeniceLLMConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.venice.ai/api/v1',
      fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.body && typeof init.body === 'string') {
          try {
            const body = JSON.parse(init.body);
            body.venice_parameters = {
              enable_web_search: 'off',
              include_venice_system_prompt: false,
            };
            init = { ...init, body: JSON.stringify(body) };
          } catch {
            /* body isn't JSON, pass through unchanged */
          }
        }
        return globalThis.fetch(url, init);
      },
    });
  }
}

export default VeniceLLM;

import { ChatOpenAI } from '@langchain/openai';
import { getGroqApiKey } from '../config';
import { ChatModel } from '.';

export const PROVIDER_INFO = {
  key: 'groq',
  displayName: 'Groq',
};
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

const groqChatModels: Record<string, string>[] = [
  {
    displayName: 'Gemma2 9B IT',
    key: 'gemma2-9b-it',
  },
  {
    displayName: 'Llama 3.3 70B Versatile',
    key: 'llama-3.3-70b-versatile',
  },
  {
    displayName: 'Llama 3.1 8B Instant',
    key: 'llama-3.1-8b-instant',
  },
  {
    displayName: 'Llama3 70B 8192',
    key: 'llama3-70b-8192',
  },
  {
    displayName: 'Llama3 8B 8192',
    key: 'llama3-8b-8192',
  },
  {
    displayName: 'Mixtral 8x7B 32768',
    key: 'mixtral-8x7b-32768',
  },
  {
    displayName: 'Qwen QWQ 32B (Preview)',
    key: 'qwen-qwq-32b',
  },
  {
    displayName: 'Mistral Saba 24B (Preview)',
    key: 'mistral-saba-24b',
  },
  {
    displayName: 'Qwen 2.5 Coder 32B (Preview)',
    key: 'qwen-2.5-coder-32b',
  },
  {
    displayName: 'Qwen 2.5 32B (Preview)',
    key: 'qwen-2.5-32b',
  },
  {
    displayName: 'DeepSeek R1 Distill Qwen 32B (Preview)',
    key: 'deepseek-r1-distill-qwen-32b',
  },
  {
    displayName: 'DeepSeek R1 Distill Llama 70B (Preview)',
    key: 'deepseek-r1-distill-llama-70b',
  },
  {
    displayName: 'Llama 3.3 70B SpecDec (Preview)',
    key: 'llama-3.3-70b-specdec',
  },
  {
    displayName: 'Llama 3.2 1B Preview (Preview)',
    key: 'llama-3.2-1b-preview',
  },
  {
    displayName: 'Llama 3.2 3B Preview (Preview)',
    key: 'llama-3.2-3b-preview',
  },
  {
    displayName: 'Llama 3.2 11B Vision Preview (Preview)',
    key: 'llama-3.2-11b-vision-preview',
  },
  {
    displayName: 'Llama 3.2 90B Vision Preview (Preview)',
    key: 'llama-3.2-90b-vision-preview',
  },
  /* {
    displayName: 'Llama 4 Maverick 17B 128E Instruct (Preview)',
    key: 'meta-llama/llama-4-maverick-17b-128e-instruct',
  }, */
  {
    displayName: 'Llama 4 Scout 17B 16E Instruct (Preview)',
    key: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
];

export const loadGroqChatModels = async () => {
  const groqApiKey = getGroqApiKey();

  if (!groqApiKey) return {};

  try {
    const chatModels: Record<string, ChatModel> = {};

    groqChatModels.forEach((model) => {
      chatModels[model.key] = {
        displayName: model.displayName,
        model: new ChatOpenAI({
          openAIApiKey: groqApiKey,
          modelName: model.key,
          temperature: 0.7,
          configuration: {
            baseURL: 'https://api.groq.com/openai/v1',
          },
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Groq models: ${err}`);
    return {};
  }
};

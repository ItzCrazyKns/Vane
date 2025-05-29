import { ChatOpenAI } from '@langchain/openai';
import { getDeepseekApiKey } from '../config';
import { ChatModel } from '.';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export const PROVIDER_INFO = {
  key: 'deepseek',
  displayName: 'Deepseek AI',
};

const deepseekChatModels: Record<string, string>[] = [
  {
    displayName: 'Deepseek Chat (Deepseek V3)',
    key: 'deepseek-chat',
  },
  {
    displayName: 'Deepseek Reasoner (Deepseek R1)',
    key: 'deepseek-reasoner',
  },
];

export const loadDeepseekChatModels = async () => {
  const deepseekApiKey = getDeepseekApiKey();

  if (!deepseekApiKey) return {};

  try {
    const chatModels: Record<string, ChatModel> = {};

    deepseekChatModels.forEach((model) => {
      chatModels[model.key] = {
        displayName: model.displayName,
        model: new ChatOpenAI({
          openAIApiKey: deepseekApiKey,
          modelName: model.key,
          temperature: 0.7,
          configuration: {
            baseURL: 'https://api.deepseek.com',
          },
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Deepseek models: ${err}`);
    return {};
  }
};

import { ChatOpenAI } from '@langchain/openai';
import { getGroqApiKey } from '../config';
import { ChatModel } from '.';

export const PROVIDER_INFO = {
  key: 'groq',
  displayName: 'Groq',
};

import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export const loadGroqChatModels = async () => {
  const groqApiKey = getGroqApiKey();
  if (!groqApiKey) return {};

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const groqChatModels = (await res.json()).data;
    const chatModels: Record<string, ChatModel> = {};

    groqChatModels.forEach((model: any) => {
      chatModels[model.id] = {
        displayName: model.id,
        model: new ChatOpenAI({
          openAIApiKey: groqApiKey,
          modelName: model.id,
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

import { ChatOpenAI } from '@langchain/openai';
import { getGroqApiKey } from '../../config';
import logger from '../../utils/logger';

export const loadGroqChatModels = async () => {
  const groqApiKey = getGroqApiKey();

  if (!groqApiKey) return {};

  try {
    const chatModels = {
      'LLaMA3 8b': new ChatOpenAI(
        {
          openAIApiKey: groqApiKey,
          modelName: 'llama3-8b-8192',
          temperature: 0.7,
        },
        {
          baseURL: 'https://api.groq.com/openai/v1',
        },
      ),
      'LLaMA3 70b': new ChatOpenAI(
        {
          openAIApiKey: groqApiKey,
          modelName: 'llama3-70b-8192',
          temperature: 0.7,
        },
        {
          baseURL: 'https://api.groq.com/openai/v1',
        },
      ),
      'Mixtral 8x7b': new ChatOpenAI(
        {
          openAIApiKey: groqApiKey,
          modelName: 'mixtral-8x7b-32768',
          temperature: 0.7,
        },
        {
          baseURL: 'https://api.groq.com/openai/v1',
        },
      ),
      'Gemma 7b': new ChatOpenAI(
        {
          openAIApiKey: groqApiKey,
          modelName: 'gemma-7b-it',
          temperature: 0.7,
        },
        {
          baseURL: 'https://api.groq.com/openai/v1',
        },
      ),
      'Gemma2 9b': new ChatOpenAI(
        {
          openAIApiKey: groqApiKey,
          modelName: 'gemma2-9b-it',
          temperature: 0.7,
        },
        {
          baseURL: 'https://api.groq.com/openai/v1',
        },
      ),
    };

    return chatModels;
  } catch (err) {
    logger.error(`Error loading Groq models: ${err}`);
    return {};
  }
};

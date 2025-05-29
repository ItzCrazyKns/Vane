import { ChatAnthropic } from '@langchain/anthropic';
import { ChatModel } from '.';
import { getAnthropicApiKey } from '../config';

export const PROVIDER_INFO = {
  key: 'anthropic',
  displayName: 'Anthropic',
};
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

const anthropicChatModels: Record<string, string>[] = [
  {
    displayName: 'Claude 3.7 Sonnet',
    key: 'claude-3-7-sonnet-20250219',
  },
  {
    displayName: 'Claude 3.5 Haiku',
    key: 'claude-3-5-haiku-20241022',
  },
  {
    displayName: 'Claude 3.5 Sonnet v2',
    key: 'claude-3-5-sonnet-20241022',
  },
  {
    displayName: 'Claude 3.5 Sonnet',
    key: 'claude-3-5-sonnet-20240620',
  },
  {
    displayName: 'Claude 3 Opus',
    key: 'claude-3-opus-20240229',
  },
  {
    displayName: 'Claude 3 Sonnet',
    key: 'claude-3-sonnet-20240229',
  },
  {
    displayName: 'Claude 3 Haiku',
    key: 'claude-3-haiku-20240307',
  },
];

export const loadAnthropicChatModels = async () => {
  const anthropicApiKey = getAnthropicApiKey();

  if (!anthropicApiKey) return {};

  try {
    const chatModels: Record<string, ChatModel> = {};

    anthropicChatModels.forEach((model) => {
      chatModels[model.key] = {
        displayName: model.displayName,
        model: new ChatAnthropic({
          apiKey: anthropicApiKey,
          modelName: model.key,
          temperature: 0.7,
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Anthropic models: ${err}`);
    return {};
  }
};

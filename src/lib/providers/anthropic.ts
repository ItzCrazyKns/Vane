import { ChatAnthropic } from '@langchain/anthropic';
import { getAnthropicApiKey } from '../../config';
import logger from '../../utils/logger';

export const loadAnthropicChatModels = async () => {
  const anthropicApiKey = getAnthropicApiKey();

  if (!anthropicApiKey) return {};

  try {
    const chatModels = {
      'claude-3-5-sonnet-20241022': {
        displayName: 'Claude 3.5 Sonnet',
        model: new ChatAnthropic({
          temperature: 0.7,
          anthropicApiKey: anthropicApiKey,
          model: 'claude-3-5-sonnet-20241022',
        }),
      },
      'claude-3-5-haiku-20241022': {
        displayName: 'Claude 3.5 Haiku',
        model: new ChatAnthropic({
          temperature: 0.7,
          anthropicApiKey: anthropicApiKey,
          model: 'claude-3-5-haiku-20241022',
        }),
      },
      'claude-3-opus-20240229': {
        displayName: 'Claude 3 Opus',
        model: new ChatAnthropic({
          temperature: 0.7,
          anthropicApiKey: anthropicApiKey,
          model: 'claude-3-opus-20240229',
        }),
      },
      'claude-3-sonnet-20240229': {
        displayName: 'Claude 3 Sonnet',
        model: new ChatAnthropic({
          temperature: 0.7,
          anthropicApiKey: anthropicApiKey,
          model: 'claude-3-sonnet-20240229',
        }),
      },
      'claude-3-haiku-20240307': {
        displayName: 'Claude 3 Haiku',
        model: new ChatAnthropic({
          temperature: 0.7,
          anthropicApiKey: anthropicApiKey,
          model: 'claude-3-haiku-20240307',
        }),
      },
    };

    return chatModels;
  } catch (err) {
    logger.error(`Error loading Anthropic models: ${err}`);
    return {};
  }
};

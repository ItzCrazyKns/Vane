import { ChatAnthropic } from '@langchain/anthropic';
import { getAnthropicApiKey } from '../../config';
import logger from '../../utils/logger';

export const loadAnthropicChatModels = async () => {
  const anthropicApiKey = getAnthropicApiKey();

  if (!anthropicApiKey) return {};

  try {
    const chatModels = {
      'Claude 3.5 Sonnet': new ChatAnthropic({
        temperature: 0.7,
        anthropicApiKey: anthropicApiKey,
        model: 'claude-3-5-sonnet-20240620',
      }),
      'Claude 3 Opus': new ChatAnthropic({
        temperature: 0.7,
        anthropicApiKey: anthropicApiKey,
        model: 'claude-3-opus-20240229',
      }),
      'Claude 3 Sonnet': new ChatAnthropic({
        temperature: 0.7,
        anthropicApiKey: anthropicApiKey,
        model: 'claude-3-sonnet-20240229',
      }),
      'Claude 3 Haiku': new ChatAnthropic({
        temperature: 0.7,
        anthropicApiKey: anthropicApiKey,
        model: 'claude-3-haiku-20240307',
      }),
    };

    return chatModels;
  } catch (err) {
    logger.error(`Error loading Anthropic models: ${err}`);
    return {};
  }
};

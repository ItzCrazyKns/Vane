import {
  getAnthropicApiKey,
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
  getGeminiApiKey,
  getGroqApiKey,
  getOllamaApiEndpoint,
  getOpenaiApiKey,
  getDeepseekApiKey,
  getAimlApiKey,
  getLMStudioApiEndpoint,
  getLemonadeApiEndpoint,
  getLemonadeApiKey,
  updateConfig,
  getOllamaApiKey,
} from '@/lib/config';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';

export const GET = async (req: Request) => {
  try {
    const config: Record<string, any> = {};

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    config['chatModelProviders'] = {};
    config['embeddingModelProviders'] = {};

    for (const provider in chatModelProviders) {
      config['chatModelProviders'][provider] = Object.keys(
        chatModelProviders[provider],
      ).map((model) => {
        return {
          name: model,
          displayName: chatModelProviders[provider][model].displayName,
        };
      });
    }

    for (const provider in embeddingModelProviders) {
      config['embeddingModelProviders'][provider] = Object.keys(
        embeddingModelProviders[provider],
      ).map((model) => {
        return {
          name: model,
          displayName: embeddingModelProviders[provider][model].displayName,
        };
      });
    }

    config['openaiApiKey'] = getOpenaiApiKey();
    config['ollamaApiUrl'] = getOllamaApiEndpoint();
    config['ollamaApiKey'] = getOllamaApiKey();
    config['lmStudioApiUrl'] = getLMStudioApiEndpoint();
    config['lemonadeApiUrl'] = getLemonadeApiEndpoint();
    config['lemonadeApiKey'] = getLemonadeApiKey();
    config['anthropicApiKey'] = getAnthropicApiKey();
    config['groqApiKey'] = getGroqApiKey();
    config['geminiApiKey'] = getGeminiApiKey();
    config['deepseekApiKey'] = getDeepseekApiKey();
    config['aimlApiKey'] = getAimlApiKey();
    config['customOpenaiApiUrl'] = getCustomOpenaiApiUrl();
    config['customOpenaiApiKey'] = getCustomOpenaiApiKey();
    config['customOpenaiModelName'] = getCustomOpenaiModelName();

    return Response.json({ ...config }, { status: 200 });
  } catch (err) {
    console.error('An error occurred while getting config:', err);
    return Response.json(
      { message: 'An error occurred while getting config' },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    const config = await req.json();

    const updatedConfig = {
      MODELS: {
        OPENAI: {
          API_KEY: config.openaiApiKey,
        },
        GROQ: {
          API_KEY: config.groqApiKey,
        },
        ANTHROPIC: {
          API_KEY: config.anthropicApiKey,
        },
        GEMINI: {
          API_KEY: config.geminiApiKey,
        },
        OLLAMA: {
          API_URL: config.ollamaApiUrl,
          API_KEY: config.ollamaApiKey,
        },
        DEEPSEEK: {
          API_KEY: config.deepseekApiKey,
        },
        AIMLAPI: {
          API_KEY: config.aimlApiKey,
        },
        LM_STUDIO: {
          API_URL: config.lmStudioApiUrl,
        },
        LEMONADE: {
          API_URL: config.lemonadeApiUrl,
          API_KEY: config.lemonadeApiKey,
        },
        CUSTOM_OPENAI: {
          API_URL: config.customOpenaiApiUrl,
          API_KEY: config.customOpenaiApiKey,
          MODEL_NAME: config.customOpenaiModelName,
        },
      },
    };

    updateConfig(updatedConfig);

    return Response.json({ message: 'Config updated' }, { status: 200 });
  } catch (err) {
    console.error('An error occurred while updating config:', err);
    return Response.json(
      { message: 'An error occurred while updating config' },
      { status: 500 },
    );
  }
};

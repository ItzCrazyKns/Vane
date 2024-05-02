import express from 'express';
import { getAvailableProviders } from '../lib/providers';
import {
  getGroqApiKey,
  getOllamaApiEndpoint,
  getOpenaiApiKey,
  updateConfig,
} from '../config';

const router = express.Router();

router.get('/', async (_, res) => {
  const config = {};

  const providers = await getAvailableProviders();

  for (const provider in providers) {
    delete providers[provider]['embeddings'];
  }

  config['providers'] = {};

  for (const provider in providers) {
    config['providers'][provider] = Object.keys(providers[provider]);
  }

  config['openaiApiKey'] = getOpenaiApiKey();
  config['ollamaApiUrl'] = getOllamaApiEndpoint();
  config['groqApiKey'] = getGroqApiKey();

  res.status(200).json(config);
});

router.post('/', async (req, res) => {
  const config = req.body;

  const updatedConfig = {
    API_KEYS: {
      OPENAI: config.openaiApiKey,
      GROQ: config.groqApiKey,
    },
    API_ENDPOINTS: {
      OLLAMA: config.ollamaApiUrl,
    },
  };

  updateConfig(updatedConfig);

  res.status(200).json({ message: 'Config updated' });
});

export default router;

import express from 'express';
import handleImageSearch from '../agents/imageSearchAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableProviders } from '../lib/providers';
import { getChatModel, getChatModelProvider } from '../config';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { query, chat_history } = req.body;

    const models = await getAvailableProviders();
    const provider = getChatModelProvider();
    const chatModel = getChatModel();

    let llm: BaseChatModel | undefined;

    if (models[provider] && models[provider][chatModel]) {
      llm = models[provider][chatModel] as BaseChatModel | undefined;
    }

    if (!llm) {
      res.status(500).json({ message: 'Invalid LLM model selected' });
      return;
    }

    const images = await handleImageSearch({ query, chat_history }, llm);

    res.status(200).json({ images });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    console.log(err.message);
  }
});

export default router;

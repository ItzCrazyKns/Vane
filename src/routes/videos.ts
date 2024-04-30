import express from 'express';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableProviders } from '../lib/providers';
import { getChatModel, getChatModelProvider } from '../config';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import logger from '../utils/logger';
import handleVideoSearch from '../agents/videoSearchAgent';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    let { query, chat_history } = req.body;

    chat_history = chat_history.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
    });

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

    const videos = await handleVideoSearch({ chat_history, query }, llm);

    res.status(200).json({ videos });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in video search: ${err.message}`);
  }
});

export default router;

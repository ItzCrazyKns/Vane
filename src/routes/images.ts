import express from 'express';
import handleImageSearch from '../agents/imageSearchAgent';
import { ChatOpenAI } from '@langchain/openai';
import { getOpenaiApiKey } from '../config';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { query, chat_history } = req.body;

    const llm = new ChatOpenAI({
      temperature: 0.7,
      openAIApiKey: getOpenaiApiKey(),
    });

    const images = await handleImageSearch({ query, chat_history }, llm);

    res.status(200).json({ images });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    console.log(err.message);
  }
});

export default router;

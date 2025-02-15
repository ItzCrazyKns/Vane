import express from 'express';
import generateSuggestions from '../chains/suggestionGeneratorAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableChatModelProviders } from '../lib/providers';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import logger from '../utils/logger';
import { ChatOpenAI } from '@langchain/openai';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '../config';

const router = express.Router();

interface ChatModel {
  provider: string;
  model: string;
}

interface SuggestionsBody {
  chatHistory: any[];
  chatModel?: ChatModel;
}

router.post('/', async (req, res) => {
  try {
    let body: SuggestionsBody = req.body;

    const chatHistory = body.chatHistory.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
    });

    const chatModelProviders = await getAvailableChatModelProviders();

    const chatModelProvider =
      body.chatModel?.provider || Object.keys(chatModelProviders)[0];
    const chatModel =
      body.chatModel?.model ||
      Object.keys(chatModelProviders[chatModelProvider])[0];

    let llm: BaseChatModel | undefined;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        modelName: getCustomOpenaiModelName(),
        openAIApiKey: getCustomOpenaiApiKey(),
        temperature: 0.7,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (
      chatModelProviders[chatModelProvider] &&
      chatModelProviders[chatModelProvider][chatModel]
    ) {
      llm = chatModelProviders[chatModelProvider][chatModel]
        .model as unknown as BaseChatModel | undefined;
    }

    if (!llm) {
      return res.status(400).json({ message: 'Invalid model selected' });
    }

    const suggestions = await generateSuggestions(
      { chat_history: chatHistory },
      llm,
    );

    res.status(200).json({ suggestions: suggestions });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in generating suggestions: ${err.message}`);
  }
});

export default router;

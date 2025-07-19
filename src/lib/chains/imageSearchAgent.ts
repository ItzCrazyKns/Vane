import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { searchSearxng } from '../searxng';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import LineOutputParser from '../outputParsers/lineOutputParser';

const imageSearchChainPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question so it is a standalone question that can be used by the LLM to search the web for images.
You need to make sure the rephrased question agrees with the conversation and is relevant to the conversation.
Output only the rephrased query wrapped in an XML <query> element. Do not include any explanation or additional text.
`;

type ImageSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

interface ImageSearchResult {
  img_src: string;
  url: string;
  title: string;
}

const strParser = new StringOutputParser();

const createImageSearchChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: ImageSearchChainInput) => {
        return formatChatHistoryAsString(input.chat_history);
      },
      query: (input: ImageSearchChainInput) => {
        return input.query;
      },
    }),
    ChatPromptTemplate.fromMessages([
      ['system', imageSearchChainPrompt],
      [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nWhat is a cat?\n</follow_up>',
      ],
      ['assistant', '<query>A cat</query>'],

      [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nWhat is a car? How does it work?\n</follow_up>',
      ],
      ['assistant', '<query>Car working</query>'],
      [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nHow does an AC work?\n</follow_up>',
      ],
      ['assistant', '<query>AC working</query>'],
      [
        'user',
        '<conversation>{chat_history}</conversation>\n<follow_up>\n{query}\n</follow_up>',
      ],
    ]),
    llm,
    strParser,
    RunnableLambda.from(async (input: string) => {
      const queryParser = new LineOutputParser({
        key: 'query',
      });

      return await queryParser.parse(input);
    }),
    RunnableLambda.from(async (input: string) => {
      const res = await searchSearxng(input, {
        engines: ['bing images', 'google images'],
      });

      const images: ImageSearchResult[] = [];

      res.results.forEach((result) => {
        if (result.img_src && result.url && result.title) {
          images.push({
            img_src: result.img_src,
            url: result.url,
            title: result.title,
          });
        }
      });

      return images.slice(0, 10);
    }),
  ]);
};

const handleImageSearch = (
  input: ImageSearchChainInput,
  llm: BaseChatModel,
) => {
  const imageSearchChain = createImageSearchChain(llm);
  return imageSearchChain.invoke(input);
};

export default handleImageSearch;

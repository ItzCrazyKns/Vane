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

const videoSearchChainPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question so it is a standalone question that can be used by the LLM to search Youtube for videos.
You need to make sure the rephrased question agrees with the conversation and is relevant to the conversation.
Output only the rephrased query wrapped in an XML <query> element. Do not include any explanation or additional text.
`;

type VideoSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

interface VideoSearchResult {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
}

const strParser = new StringOutputParser();

const createVideoSearchChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: VideoSearchChainInput) => {
        return formatChatHistoryAsString(input.chat_history);
      },
      query: (input: VideoSearchChainInput) => {
        return input.query;
      },
    }),
    ChatPromptTemplate.fromMessages([
      ['system', videoSearchChainPrompt],
      [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nHow does a car work?\n</follow_up>',
      ],
      ['assistant', '<query>How does a car work?</query>'],
      [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nWhat is the theory of relativity?\n</follow_up>',
      ],
      ['assistant', '<query>Theory of relativity</query>'],
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
        engines: ['youtube'],
      });

      const videos: VideoSearchResult[] = [];

      res.results.forEach((result) => {
        if (
          result.thumbnail &&
          result.url &&
          result.title &&
          result.iframe_src
        ) {
          videos.push({
            img_src: result.thumbnail,
            url: result.url,
            title: result.title,
            iframe_src: result.iframe_src,
          });
        }
      });

      return videos.slice(0, 10);
    }),
  ]);
};

const handleVideoSearch = (
  input: VideoSearchChainInput,
  llm: BaseChatModel,
) => {
  const videoSearchChain = createVideoSearchChain(llm);
  return videoSearchChain.invoke(input);
};

export default handleVideoSearch;

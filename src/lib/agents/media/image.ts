/* I don't think can be classified as agents but to keep the structure consistent i guess ill keep it here */

import { isSearxngError, searchSearxng } from '@/lib/searxng';
import {
  imageSearchFewShots,
  imageSearchPrompt,
} from '@/lib/prompts/media/image';
import BaseLLM from '@/lib/models/base/llm';
import z from 'zod';
import { ChatTurnMessage } from '@/lib/types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';

type ImageSearchChainInput = {
  chatHistory: ChatTurnMessage[];
  query: string;
};

type ImageSearchResult = {
  img_src: string;
  url: string;
  title: string;
};

const searchImages = async (
  input: ImageSearchChainInput,
  llm: BaseLLM<any>,
) => {
  const schema = z.object({
    query: z.string().describe('The image search query.'),
  });

  const res = await llm.generateObject<typeof schema>({
    messages: [
      {
        role: 'system',
        content: imageSearchPrompt,
      },
      ...imageSearchFewShots,
      {
        role: 'user',
        content: `<conversation>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation>\n<follow_up>\n${input.query}\n</follow_up>`,
      },
    ],
    schema: schema,
  });

  let searchRes;
  try {
    searchRes = await searchSearxng(res.query, {
      engines: ['bing images', 'google images'],
    });
  } catch (error) {
    if (isSearxngError(error)) {
      console.warn(
        `Image search skipped because SearXNG is unavailable: ${error.message}`,
      );
      return [];
    }

    throw error;
  }

  const images: ImageSearchResult[] = [];

  searchRes.results.forEach((result) => {
    if (result.img_src && result.url && result.title) {
      images.push({
        img_src: result.img_src,
        url: result.url,
        title: result.title,
      });
    }
  });

  return images.slice(0, 10);
};

export default searchImages;

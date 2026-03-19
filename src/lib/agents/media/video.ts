import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { searchSearxng } from '@/lib/searxng';
import {
  videoSearchFewShots,
  videoSearchPrompt,
} from '@/lib/prompts/media/videos';
import { ChatTurnMessage } from '@/lib/types';
import BaseLLM from '@/lib/models/base/llm';
import z from 'zod';

type VideoSearchChainInput = {
  chatHistory: ChatTurnMessage[];
  query: string;
};

type VideoSearchResult = {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
};

const searchVideos = async (
  input: VideoSearchChainInput,
  llm: BaseLLM<any>,
) => {
  const schema = z.object({
    query: z.string().describe('The video search query.'),
  });

  const res = await llm.generateObject<typeof schema>({
    messages: [
      {
        role: 'system',
        content: videoSearchPrompt,
      },
      ...videoSearchFewShots,
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
      engines: ['youtube'],
    });
  } catch (error) {
    console.error('Video search failed:', error instanceof Error ? error.message : error);
    return [];
  }

  const videos: VideoSearchResult[] = [];

  searchRes.results.forEach((result) => {
    if (result.thumbnail && result.url && result.title && result.iframe_src) {
      // Normalize embed URL - some SearXNG instances return
      // youtube-nocookie.com which doesn't resolve on all networks
      const embedUrl = result.iframe_src.replace(
        'www.youtube-nocookie.com/embed',
        'www.youtube.com/embed',
      );
      videos.push({
        img_src: result.thumbnail,
        url: result.url,
        title: result.title,
        iframe_src: embedUrl,
      });
    }
  });

  return videos.slice(0, 10);
};

export default searchVideos;

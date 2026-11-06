import { getKeywordItems, getTopicItems } from '@/lib/discover/fetchTopic';
import {
  findDiscoverTopic,
  getDiscoverTopics,
  toDiscoverLocale,
} from '@/lib/discover/topics';

/** Longest keyword accepted for a followed subject. */
const MAX_QUERY_LENGTH = 80;

/**
 * GET /api/discover
 *
 * - `lang`: `pt-BR` (default) or `en`, picks the curated sources.
 * - `topic`: id of a built-in topic (see `src/lib/discover/topics.ts`).
 * - `q`: a followed subject; searched instead of a built-in topic.
 * - `mode=preview`: first topic of the language, used by the home widget.
 */
export const GET = async (req: Request) => {
  try {
    const params = new URL(req.url).searchParams;
    const locale = toDiscoverLocale(params.get('lang'));
    const query = params.get('q')?.trim();

    if (query) {
      if (query.length > MAX_QUERY_LENGTH) {
        return Response.json({ message: 'Query too long' }, { status: 400 });
      }
      return Response.json({ blogs: await getKeywordItems(query, locale) });
    }

    const defaultTopic = getDiscoverTopics(locale)[0];
    const topicId =
      params.get('mode') === 'preview'
        ? defaultTopic.id
        : (params.get('topic') ?? defaultTopic.id);
    const topic = findDiscoverTopic(locale, topicId);

    if (!topic) {
      return Response.json({ message: 'Invalid topic' }, { status: 400 });
    }

    return Response.json({ blogs: await getTopicItems(topic, locale) });
  } catch (err) {
    console.error(`An error occurred in discover route: ${err}`);
    return Response.json({ message: 'An error has occurred' }, { status: 500 });
  }
};

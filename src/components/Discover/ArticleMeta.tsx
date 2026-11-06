import { useFormatter } from 'next-intl';
import type { DiscoverItem } from '@/lib/discover/types';

/** "g1.globo.com · 2 hours ago", whichever parts are known. */
const ArticleMeta = ({ item }: { item: DiscoverItem }) => {
  const format = useFormatter();
  const date = item.publishedAt ? new Date(item.publishedAt) : undefined;
  const now = new Date();
  const source = item.source?.startsWith('news.google.com')
    ? undefined
    : item.source;

  if (!source && !date) return null;

  return (
    <p className="text-[11px] text-black/50 dark:text-white/50 mb-1 truncate">
      {[source, date && format.relativeTime(date, now)]
        .filter(Boolean)
        .join(' · ')}
    </p>
  );
};

export default ArticleMeta;

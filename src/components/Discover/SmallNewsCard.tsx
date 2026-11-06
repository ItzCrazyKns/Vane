import Link from 'next/link';
import type { DiscoverItem } from '@/lib/discover/types';
import ArticleImage from './ArticleImage';
import ArticleMeta from './ArticleMeta';
import { useArticleLink } from './useArticleLink';

const SmallNewsCard = ({ item }: { item: DiscoverItem }) => {
  const link = useArticleLink(item.url);
  return (
    <Link
      href={link.href}
      className="rounded-3xl overflow-hidden bg-light-secondary dark:bg-dark-secondary shadow-sm shadow-light-200/10 dark:shadow-black/25 group flex flex-col"
      target="_blank"
      rel={link.external ? 'noopener noreferrer' : undefined}
    >
      <div className="relative aspect-video overflow-hidden">
        <ArticleImage
          src={item.thumbnail}
          alt={item.title}
          className="group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <ArticleMeta item={item} />
        <h3 className="font-semibold text-sm mb-2 leading-tight line-clamp-2 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition duration-200">
          {item.title}
        </h3>
        <p className="text-black/60 dark:text-white/60 text-xs leading-relaxed line-clamp-2">
          {item.content}
        </p>
      </div>
    </Link>
  );
};

export default SmallNewsCard;

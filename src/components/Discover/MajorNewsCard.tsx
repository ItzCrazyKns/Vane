import Link from 'next/link';
import type { DiscoverItem } from '@/lib/discover/types';
import ArticleImage from './ArticleImage';
import ArticleMeta from './ArticleMeta';
import { useArticleLink } from './useArticleLink';

const MajorNewsCard = ({
  item,
  isLeft = true,
}: {
  item: DiscoverItem;
  isLeft?: boolean;
}) => {
  const link = useArticleLink(item.url);

  const image = (
    <div className="relative w-80 h-full overflow-hidden rounded-2xl flex-shrink-0">
      <ArticleImage
        src={item.thumbnail}
        alt={item.title}
        className="group-hover:scale-105 transition-transform duration-500"
      />
    </div>
  );

  const text = (
    <div className="flex flex-col justify-center flex-1 py-4">
      <ArticleMeta item={item} />
      <h2
        className="text-3xl font-light mb-3 leading-tight line-clamp-3 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition duration-200"
        style={{ fontFamily: 'PP Editorial, serif' }}
      >
        {item.title}
      </h2>
      <p className="text-black/60 dark:text-white/60 text-base leading-relaxed line-clamp-4">
        {item.content}
      </p>
    </div>
  );

  return (
    <Link
      href={link.href}
      className="w-full group flex flex-row items-stretch gap-6 h-60 py-3"
      target="_blank"
      rel={link.external ? 'noopener noreferrer' : undefined}
    >
      {isLeft ? (
        <>
          {image}
          {text}
        </>
      ) : (
        <>
          {text}
          {image}
        </>
      )}
    </Link>
  );
};

export default MajorNewsCard;

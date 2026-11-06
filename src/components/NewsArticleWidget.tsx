import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { DiscoverItem } from '@/lib/discover/types';
import ArticleImage from './Discover/ArticleImage';
import { useArticleLink } from './Discover/useArticleLink';

type Article = DiscoverItem;

const ArticleLink = ({ article }: { article: Article }) => {
  const link = useArticleLink(article.url);
  return (
    <a
      href={link.href}
      target={link.external ? '_blank' : undefined}
      rel={link.external ? 'noopener noreferrer' : undefined}
      className="flex flex-row items-stretch w-full h-full relative overflow-hidden group"
    >
      <div className="relative w-24 min-w-24 max-w-24 h-full overflow-hidden">
        <ArticleImage
          src={article.thumbnail}
          alt={article.title}
          className="group-hover:scale-110 transition-transform duration-300"
        />
      </div>
      <div className="flex flex-col justify-center flex-1 px-3 py-2">
        <div className="font-semibold text-xs text-black dark:text-white leading-tight line-clamp-2 mb-1">
          {article.title}
        </div>
        <p className="text-black/60 dark:text-white/60 text-[10px] leading-relaxed line-clamp-2">
          {article.content}
        </p>
      </div>
    </a>
  );
};

const NewsArticleWidget = () => {
  const t = useTranslations('NewsWidget');
  const locale = useLocale();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/discover?mode=preview&lang=${encodeURIComponent(locale)}`)
      .then((res) => res.json())
      .then((data) => {
        const all: Article[] = data.blogs || [];
        // Prefer one of the newest articles that has an image.
        const withImage = all.slice(0, 10).filter((a) => a.thumbnail);
        const pool = withImage.length > 0 ? withImage : all.slice(0, 10);
        setArticle(pool[Math.floor(Math.random() * pool.length)] ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [locale]);

  return (
    <div className="bg-light-secondary dark:bg-dark-secondary rounded-2xl border border-light-200 dark:border-dark-200 shadow-sm shadow-light-200/10 dark:shadow-black/25 flex flex-row items-stretch w-full h-24 min-h-[96px] max-h-[96px] p-0 overflow-hidden">
      {loading ? (
        <div className="animate-pulse flex flex-row items-stretch w-full h-full">
          <div className="w-24 min-w-24 max-w-24 h-full bg-light-200 dark:bg-dark-200" />
          <div className="flex flex-col justify-center flex-1 px-3 py-2 gap-2">
            <div className="h-4 w-3/4 rounded bg-light-200 dark:bg-dark-200" />
            <div className="h-3 w-1/2 rounded bg-light-200 dark:bg-dark-200" />
          </div>
        </div>
      ) : error ? (
        <div className="w-full text-xs text-red-400">{t('error')}</div>
      ) : article ? (
        <ArticleLink article={article} />
      ) : null}
    </div>
  );
};

export default NewsArticleWidget;

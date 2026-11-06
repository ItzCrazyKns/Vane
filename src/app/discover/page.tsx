'use client';

import {
  CheckIcon,
  Globe2Icon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DiscoverGrid from '@/components/Discover/DiscoverGrid';
import {
  MAX_TOPIC_QUERY_LENGTH,
  useDiscoverTopicPrefs,
} from '@/lib/discover/clientTopics';
import { getDiscoverTopics, toDiscoverLocale } from '@/lib/discover/topics';
import type { DiscoverItem } from '@/lib/discover/types';

/** A pill in the topic bar: a built-in topic or a followed subject. */
interface TopicPill {
  id: string;
  label: string;
  /** Set for followed subjects. */
  query?: string;
}

const pillClass = (active: boolean) =>
  cn(
    'flex items-center gap-1 border-[0.1px] rounded-full text-sm px-3 py-1 text-nowrap transition duration-200 cursor-pointer',
    active
      ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-300/20 border-cyan-700/60 dark:bg-cyan-300/30 dark:border-cyan-300/40'
      : 'border-black/30 dark:border-white/30 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 hover:bg-black/5 dark:hover:bg-white/5',
  );

const matches = (item: DiscoverItem, words: string[]) => {
  const text =
    `${item.title} ${item.content} ${item.source ?? ''}`.toLowerCase();
  return words.every((w) => text.includes(w));
};

const Spinner = () => (
  <div className="flex flex-row items-center justify-center min-h-screen">
    <svg
      aria-hidden="true"
      className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
      viewBox="0 0 100 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
        fill="currentColor"
      />
      <path
        d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
        fill="currentFill"
      />
    </svg>
  </div>
);

const Page = () => {
  const t = useTranslations('Discover');
  const locale = toDiscoverLocale(useLocale());
  const { prefs, loaded, follow, remove, restoreDefaults } =
    useDiscoverTopicPrefs();

  const [discover, setDiscover] = useState<DiscoverItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [filter, setFilter] = useState('');

  const pills = useMemo<TopicPill[]>(
    () => [
      ...getDiscoverTopics(locale)
        .filter((topic) => !prefs.hidden.includes(topic.id))
        .map((topic) => {
          const key = `topics.${topic.id}` as Parameters<typeof t>[0];
          return { id: topic.id, label: t.has(key) ? t(key) : topic.id };
        }),
      ...prefs.followed.map((f) => ({
        id: f.id,
        label: f.label,
        query: f.query,
      })),
    ],
    [locale, prefs, t],
  );

  const active = pills.find((p) => p.id === activeId) ?? pills[0];

  useEffect(() => {
    if (!loaded) return;
    if (!active) {
      setDiscover([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ lang: locale });
    if (active.query) params.set('q', active.query);
    else params.set('topic', active.id);

    setLoading(true);
    setFilter('');
    fetch(`/api/discover?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setDiscover(data.blogs ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('Error fetching data:', err.message);
        toast.error(t('fetchError'));
        setDiscover([]);
        setLoading(false);
      });

    return () => controller.abort();
  }, [loaded, active?.id, active?.query, locale, t]);

  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const visible =
    words.length > 0
      ? (discover ?? []).filter((item) => matches(item, words))
      : (discover ?? []);

  const followAndOpen = (text: string) => {
    const query = text
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, MAX_TOPIC_QUERY_LENGTH);
    if (!query) return;
    follow(query);
    setActiveId(`q:${query.toLowerCase()}`);
  };

  const submitNewTopic = (e: FormEvent) => {
    e.preventDefault();
    followAndOpen(newTopic);
    setNewTopic('');
    setAdding(false);
  };

  return (
    <div>
      <div className="flex flex-col pt-10 border-b border-light-200/20 dark:border-dark-200/20 pb-6 px-2 gap-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center lg:justify-start">
            <Globe2Icon size={45} className="mb-2.5" />
            <h1
              className="text-5xl font-normal p-2"
              style={{ fontFamily: 'PP Editorial, serif' }}
            >
              {t('title')}
            </h1>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2">
            {pills.map((pill) => (
              <div
                key={pill.id}
                className={pillClass(!editing && active?.id === pill.id)}
                onClick={() => !editing && setActiveId(pill.id)}
              >
                <span>{pill.label}</span>
                {editing && (
                  <button
                    type="button"
                    aria-label={t('remove', { topic: pill.label })}
                    className="ml-1 rounded-full hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(pill.id);
                    }}
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>
            ))}

            {adding ? (
              <form onSubmit={submitNewTopic} className="flex items-center">
                <input
                  autoFocus
                  value={newTopic}
                  maxLength={MAX_TOPIC_QUERY_LENGTH}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onBlur={() => !newTopic.trim() && setAdding(false)}
                  onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
                  placeholder={t('addPlaceholder')}
                  className="rounded-full text-sm px-3 py-1 w-44 bg-transparent border border-cyan-700/60 dark:border-cyan-300/40 outline-none"
                />
              </form>
            ) : (
              <button
                type="button"
                className={pillClass(false)}
                onClick={() => setAdding(true)}
              >
                <PlusIcon size={14} />
                <span>{t('add')}</span>
              </button>
            )}

            {editing && prefs.hidden.length > 0 && (
              <button
                type="button"
                className={pillClass(false)}
                onClick={restoreDefaults}
              >
                <RotateCcwIcon size={14} />
                <span>{t('restore')}</span>
              </button>
            )}

            <button
              type="button"
              aria-label={editing ? t('doneEditing') : t('editTopics')}
              title={editing ? t('doneEditing') : t('editTopics')}
              className={pillClass(editing)}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? <CheckIcon size={14} /> : <PencilIcon size={14} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-1 rounded-full border border-black/20 dark:border-white/20 px-3 py-1.5">
            <SearchIcon
              size={16}
              className="text-black/50 dark:text-white/50"
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('filterPlaceholder')}
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {filter && (
              <button
                type="button"
                aria-label={t('clearFilter')}
                onClick={() => setFilter('')}
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
          {filter.trim() && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={pillClass(false)}
                onClick={() => followAndOpen(filter)}
              >
                <PlusIcon size={14} />
                <span>{t('follow', { topic: filter.trim() })}</span>
              </button>
              <Link
                href={`/?q=${encodeURIComponent(filter.trim())}`}
                className={pillClass(false)}
              >
                <SparklesIcon size={14} />
                <span>{t('askAi')}</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : pills.length === 0 ? (
        <p className="text-center text-black/60 dark:text-white/60 py-20">
          {t('noTopics')}
        </p>
      ) : visible.length === 0 ? (
        <p className="text-center text-black/60 dark:text-white/60 py-20">
          {words.length > 0 ? t('noMatches') : t('empty')}
        </p>
      ) : (
        <DiscoverGrid items={visible} />
      )}
    </div>
  );
};

export default Page;

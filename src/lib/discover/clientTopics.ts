'use client';

import { useCallback, useEffect, useState } from 'react';

/** A subject the user follows. Its articles come from `/api/discover?q=`. */
export interface FollowedTopic {
  id: string;
  label: string;
  query: string;
}

/** What the user changed about the Discover topics, kept in localStorage. */
export interface DiscoverTopicPrefs {
  /** Built-in topic ids the user removed. */
  hidden: string[];
  followed: FollowedTopic[];
}

export const DISCOVER_TOPICS_KEY = 'discoverTopics';
export const MAX_FOLLOWED_TOPICS = 20;
export const MAX_TOPIC_QUERY_LENGTH = 80;

const emptyPrefs = (): DiscoverTopicPrefs => ({ hidden: [], followed: [] });

/** Reads the saved preferences, ignoring anything malformed. */
export const parseTopicPrefs = (raw: string | null): DiscoverTopicPrefs => {
  if (!raw) return emptyPrefs();
  try {
    const value = JSON.parse(raw);
    const hidden = Array.isArray(value?.hidden)
      ? value.hidden.filter((id: unknown) => typeof id === 'string')
      : [];
    const followed = Array.isArray(value?.followed)
      ? value.followed.filter(
          (t: any) =>
            t &&
            typeof t.id === 'string' &&
            typeof t.label === 'string' &&
            typeof t.query === 'string',
        )
      : [];
    return { hidden, followed };
  } catch {
    return emptyPrefs();
  }
};

const followedId = (query: string) =>
  `q:${query.toLowerCase().replace(/\s+/g, ' ')}`;

/** Adds a followed subject. Returns the same prefs when it is empty or a duplicate. */
export const followTopic = (
  prefs: DiscoverTopicPrefs,
  text: string,
): DiscoverTopicPrefs => {
  const query = text
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_TOPIC_QUERY_LENGTH);
  if (!query) return prefs;
  const id = followedId(query);
  if (prefs.followed.some((t) => t.id === id)) return prefs;
  if (prefs.followed.length >= MAX_FOLLOWED_TOPICS) return prefs;
  return {
    ...prefs,
    followed: [...prefs.followed, { id, label: query, query }],
  };
};

/** Removes a followed subject, or hides a built-in topic. */
export const removeTopic = (
  prefs: DiscoverTopicPrefs,
  id: string,
): DiscoverTopicPrefs => {
  if (prefs.followed.some((t) => t.id === id)) {
    return { ...prefs, followed: prefs.followed.filter((t) => t.id !== id) };
  }
  if (prefs.hidden.includes(id)) return prefs;
  return { ...prefs, hidden: [...prefs.hidden, id] };
};

/** Discover topic preferences, saved in this browser. */
export const useDiscoverTopicPrefs = () => {
  const [prefs, setPrefs] = useState<DiscoverTopicPrefs>(emptyPrefs);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(parseTopicPrefs(localStorage.getItem(DISCOVER_TOPICS_KEY)));
    setLoaded(true);
  }, []);

  const update = useCallback(
    (change: (prefs: DiscoverTopicPrefs) => DiscoverTopicPrefs) => {
      setPrefs((current) => {
        const next = change(current);
        if (next !== current) {
          localStorage.setItem(DISCOVER_TOPICS_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    [],
  );

  return {
    prefs,
    loaded,
    follow: (text: string) => update((p) => followTopic(p, text)),
    remove: (id: string) => update((p) => removeTopic(p, id)),
    restoreDefaults: () => update((p) => ({ ...p, hidden: [] })),
  };
};

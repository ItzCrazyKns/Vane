'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import {
  DiscoverClickAction,
  getDiscoverClickAction,
} from '@/lib/config/clientRegistry';

const subscribe = () => () => {};
const getServerAction = (): DiscoverClickAction => 'summarize';

/**
 * Link for a Discover article: either a chat that summarizes it, or the
 * article itself, depending on the "Discover article click" preference.
 */
export const useArticleLink = (url: string) => {
  const t = useTranslations('NewsWidget');
  // The preference lives in localStorage: read it only on the client.
  const action = useSyncExternalStore(
    subscribe,
    getDiscoverClickAction,
    getServerAction,
  );

  if (action === 'open') {
    return { href: url, external: true };
  }
  return {
    href: `/?q=${encodeURIComponent(t('summaryQuery', { url }))}`,
    external: false,
  };
};

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  DiscoverClickAction,
  getDiscoverClickAction,
} from '@/lib/config/clientRegistry';

/**
 * Link for a Discover article: either a chat that summarizes it, or the
 * article itself, depending on the "Discover article click" preference.
 */
export const useArticleLink = (url: string) => {
  const t = useTranslations('NewsWidget');
  const [action, setAction] = useState<DiscoverClickAction>('summarize');

  useEffect(() => {
    setAction(getDiscoverClickAction());
  }, []);

  if (action === 'open') {
    return { href: url, external: true };
  }
  return {
    href: `/?q=${encodeURIComponent(t('summaryQuery', { url }))}`,
    external: false,
  };
};

'use client';

/* eslint-disable @next/next/no-img-element */
import { createContext, useContext } from 'react';
import type { Chunk } from '@/lib/types';
import { faviconSrc, hideBrokenImage } from '@/lib/favicon';
import { safeHref } from '@/lib/markdownSafety';

/**
 * Sources of the message being rendered, in citation order: [1] is
 * sources[0]. The same list `processTextBlock` used to turn [n] into
 * <citation> links, so the number always points at the same source.
 */
export const CitationSourcesContext = createContext<Chunk[]>([]);

/** Characters of the source text shown in the hover preview. */
export const PREVIEW_CHARS = 280;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const previewText = (content: unknown) => {
  if (typeof content !== 'string') return '';
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_CHARS
    ? `${text.slice(0, PREVIEW_CHARS).trimEnd()}…`
    : text;
};

/**
 * A citation number in the answer. Hovering (or focusing) it shows which
 * source it points to: site, title, date and the start of the text the
 * writer read, as Perplexity does, so the reader can check a claim
 * without leaving the answer.
 */
const Citation = ({
  href,
  children,
}: {
  href: string;
  children?: React.ReactNode;
}) => {
  const sources = useContext(CitationSourcesContext);
  const index = parseInt(
    String(Array.isArray(children) ? children[0] : children),
    10,
  );
  const source = Number.isFinite(index) ? sources[index - 1] : undefined;
  const link = safeHref(href);
  const isFile = typeof href === 'string' && href.startsWith('file_id://');

  const preview = source ? previewText(source.content) : '';
  const title = source?.metadata?.title;
  const date = source?.metadata?.publishedDate;

  return (
    <span className="relative inline-block group/citation">
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 relative"
      >
        {children}
      </a>
      {source && (title || preview) && (
        <span
          role="tooltip"
          className="pointer-events-none invisible opacity-0 group-hover/citation:visible group-hover/citation:opacity-100 group-focus-within/citation:visible group-focus-within/citation:opacity-100 transition-opacity duration-150 absolute left-0 top-full z-30 mt-1 w-72 max-w-[80vw] rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-3 shadow-lg text-left not-prose"
        >
          {!isFile && link && (
            <span className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
              <img
                src={faviconSrc(link)}
                onError={hideBrokenImage}
                width={14}
                height={14}
                alt=""
                className="h-3.5 w-3.5 rounded"
              />
              <span className="truncate">{hostOf(link)}</span>
              {date && <span className="shrink-0">· {date}</span>}
            </span>
          )}
          {title && (
            <span className="mt-1 block text-sm font-medium leading-snug text-black dark:text-white line-clamp-2">
              {title}
            </span>
          )}
          {preview && (
            <span className="mt-1 block text-xs leading-relaxed text-black/70 dark:text-white/70 line-clamp-5">
              {preview}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

export default Citation;

import { JSDOM } from 'jsdom';
import type { DiscoverItem } from './types';

/** Time allowed for one feed request. */
export const FEED_TIMEOUT_MS = 8000;
/** Articles kept per feed, so one busy feed does not crowd out the others. */
export const MAX_ITEMS_PER_FEED = 15;
const EXCERPT_LENGTH = 280;

const firstByTag = (el: Element, ...tags: string[]) => {
  for (const tag of tags) {
    const found = el.getElementsByTagName(tag)[0];
    if (found) return found;
  }
  return undefined;
};

const textOf = (el: Element, ...tags: string[]) =>
  firstByTag(el, ...tags)?.textContent?.trim() ?? '';

/** Turns an HTML snippet into plain text (entities decoded, tags dropped). */
export const htmlToText = (html: string) => {
  if (!html) return '';
  const text = JSDOM.fragment(`<div>${html}</div>`).textContent ?? '';
  return text.replace(/\s+/g, ' ').trim();
};

const firstImgSrc = (html: string) => {
  if (!html || !/<img/i.test(html)) return undefined;
  const img = JSDOM.fragment(html).querySelector('img');
  return img?.getAttribute('src') ?? img?.getAttribute('data-src') ?? undefined;
};

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** Some publishers wrap links in a tracking redirect; keep the real URL. */
export const unwrapLink = (link: string) => {
  const folha = link.match(
    /^https?:\/\/redir\.folha\.com\.br\/.*?\*(https?:\/\/.+)$/,
  );
  return folha ? folha[1] : link;
};

const findImage = (item: Element, html: string) => {
  for (const tag of ['media:content', 'media:thumbnail']) {
    for (const el of Array.from(item.getElementsByTagName(tag))) {
      const url = el.getAttribute('url');
      const medium = el.getAttribute('medium');
      const type = el.getAttribute('type');
      if (
        url &&
        (!medium || medium === 'image') &&
        (!type || type.startsWith('image'))
      ) {
        return url;
      }
    }
  }

  for (const el of Array.from(item.getElementsByTagName('enclosure'))) {
    const type = el.getAttribute('type') ?? '';
    if (type.startsWith('image') && el.getAttribute('url')) {
      return el.getAttribute('url')!;
    }
  }

  const itunes = firstByTag(item, 'itunes:image');
  if (itunes?.getAttribute('href')) return itunes.getAttribute('href')!;

  return firstImgSrc(html);
};

const toIsoDate = (value: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const atomLink = (entry: Element) => {
  const links = Array.from(entry.getElementsByTagName('link'));
  const alternate =
    links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate') ??
    links[0];
  return (
    alternate?.getAttribute('href') ?? alternate?.textContent?.trim() ?? ''
  );
};

/**
 * Parses an RSS 0.9x/2.0 or Atom document into Discover items.
 * Items without a title or an http(s) link are skipped.
 */
export const parseFeed = (xml: string): DiscoverItem[] => {
  const doc = new JSDOM(xml, { contentType: 'text/xml' }).window.document;
  const rssItems = Array.from(doc.getElementsByTagName('item'));
  const isAtom = rssItems.length === 0;
  const nodes = isAtom
    ? Array.from(doc.getElementsByTagName('entry'))
    : rssItems;

  const items: DiscoverItem[] = [];

  for (const node of nodes) {
    const title = htmlToText(textOf(node, 'title'));
    const rawLink = isAtom ? atomLink(node) : textOf(node, 'link', 'guid');
    const url = unwrapLink(rawLink.trim());

    if (!title || !/^https?:\/\//i.test(url)) continue;

    const html = isAtom
      ? textOf(node, 'summary', 'content')
      : textOf(node, 'description', 'content:encoded');
    const fullHtml = isAtom
      ? html
      : `${html}${textOf(node, 'content:encoded')}`;

    items.push({
      title,
      url,
      content: truncate(htmlToText(html), EXCERPT_LENGTH),
      thumbnail: findImage(node, fullHtml),
      source: hostOf(url),
      publishedAt: toIsoDate(
        textOf(node, 'pubDate', 'published', 'updated', 'dc:date'),
      ),
    });

    if (items.length >= MAX_ITEMS_PER_FEED) break;
  }

  return items;
};

/** Downloads and parses one feed. Throws on network errors, timeouts and non-2xx. */
export const fetchFeed = async (url: string): Promise<DiscoverItem[]> => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: {
      Accept:
        'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
      'User-Agent': 'Vane/1.0 (+https://github.com/module195/Vane)',
    },
  });

  if (!res.ok) throw new Error(`Feed ${url} returned ${res.status}`);

  return parseFeed(decodeFeed(await res.arrayBuffer(), res.headers));
};

/**
 * Decodes a feed body with its declared charset. Several Brazilian feeds
 * (Folha's RSS 0.91, for one) are ISO-8859-1, which `res.text()` would garble.
 */
export const decodeFeed = (body: ArrayBuffer, headers?: Headers) => {
  const fromHeader = headers
    ?.get('content-type')
    ?.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = new TextDecoder('latin1').decode(body.slice(0, 200));
  const fromXml = head.match(/<\?xml[^>]*encoding=["']([\w-]+)["']/i)?.[1];
  const label = fromXml ?? fromHeader ?? 'utf-8';

  try {
    return new TextDecoder(label).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
};

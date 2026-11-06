/**
 * Normalizes an article image URL for display.
 *
 * Bing News thumbnails (`th.bing.com/th?id=...&w=...`) carry sizing params
 * that crop the image badly, so for Bing only the `id` param is kept. Any
 * other host is returned unchanged. Invalid or non-http(s) URLs give
 * `undefined`, so a card shows no image instead of crashing.
 */
export const cleanThumbnailUrl = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;

  if (url.hostname.endsWith('bing.com') && url.searchParams.get('id')) {
    return `${url.origin}${url.pathname}?id=${url.searchParams.get('id')}`;
  }

  return url.toString();
};

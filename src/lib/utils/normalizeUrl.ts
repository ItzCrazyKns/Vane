const TRACKING_PARAMS = new Set(['fbclid', 'gclid']);

/**
 * Key used to spot the same page reached through different URLs: host in
 * lower case, no #fragment, no utm_* / fbclid / gclid parameters, no
 * trailing slash on the path. Only for comparison; the original URL is
 * the one shown and cited. Strings that are not http(s) URLs (file_id://
 * uploads, junk) are returned trimmed.
 */
export const normalizeUrl = (raw: string): string => {
  const input = raw.trim();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return input;

  for (const key of Array.from(url.searchParams.keys())) {
    const k = key.toLowerCase();
    if (k.startsWith('utm_') || TRACKING_PARAMS.has(k)) {
      url.searchParams.delete(key);
    }
  }

  const path = url.pathname.replace(/\/+$/, '');
  const query = url.searchParams.toString();
  /* URL already lower-cases the host and drops default ports; the
     fragment is left out. */
  return `${url.protocol}//${url.host}${path}${query ? `?${query}` : ''}`;
};

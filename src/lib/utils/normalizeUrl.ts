/* Builds a dedup KEY for a URL. The key is for comparing URLs, never for display or fetching. */

// Query parameters that only track the click and never change the page.
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref_src',
  'igshid',
  '_ga',
  'yclid',
]);

// True when a query parameter (name and raw value) should be dropped.
const isTrackingParam = (name: string, value: string): boolean => {
  const key = name.toLowerCase();
  if (key.startsWith('utm_')) return true;
  if (TRACKING_PARAMS.has(key)) return true;
  // 'ref' is dropped only when it carries a value; a bare '?ref=' is kept.
  if (key === 'ref') return value !== '';
  return false;
};

// Decodes a query parameter name; a malformed escape keeps the raw text.
const safeDecode = (text: string): string => {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
};

/*
  Normalises a URL so that two links to the same page get the same key:
  - scheme and host lowercased, default ports dropped (the URL parser does both)
  - fragment dropped
  - tracking params dropped, every other param kept in its original order
    and with its original encoding
  - trailing slash removed, except for the bare root '/'
  - http and https give the same key (the key always says 'https:')
  Returns the input unchanged when it cannot be parsed.
*/
export const normalizeUrl = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const isWeb = parsed.protocol === 'http:' || parsed.protocol === 'https:';

  parsed.hash = '';

  // Filter the raw query string by hand so kept params keep their encoding.
  const kept = parsed.search
    .replace(/^\?/, '')
    .split('&')
    .filter((part) => part !== '')
    .filter((part) => {
      const eq = part.indexOf('=');
      const name = eq === -1 ? part : part.slice(0, eq);
      const value = eq === -1 ? '' : part.slice(eq + 1);
      return !isTrackingParam(safeDecode(name), value);
    });
  parsed.search = kept.length > 0 ? `?${kept.join('&')}` : '';

  if (isWeb) {
    // Setting the protocol also drops port 443 when it becomes the default.
    if (parsed.protocol === 'http:') parsed.protocol = 'https:';

    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    }
  }

  return parsed.toString();
};

export default normalizeUrl;

import { assertPublicHttpUrl } from './privateNetwork.ts';
import type { UrlPolicyOptions } from './privateNetwork.ts';

/**
 * Schemes the browser serves itself, which never reach the network.
 */
const BROWSER_SERVED_SCHEMES = new Set(['about:', 'blob:', 'data:']);

/**
 * Decide whether the scraping context may send a request to this URL.
 *
 * Only http and https URLs are checked against the shared destination policy.
 * The browser serves about:, blob: and data: URLs itself, so they are
 * allowed. Every other scheme, including ws: and wss:, is refused: request
 * interception does not see WebSocket traffic, so the scraper also closes
 * every WebSocket at the context level.
 */
export async function isAllowedRequestUrl(
  value: string,
  options: UrlPolicyOptions = {},
): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }

  if (BROWSER_SERVED_SCHEMES.has(url.protocol)) return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  try {
    await assertPublicHttpUrl(url.href, options);
    return true;
  } catch {
    return false;
  }
}

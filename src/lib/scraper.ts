import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Mutex } from 'async-mutex';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_V4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function ipv4ToInt(address: string): number {
  return address
    .split('.')
    .reduce((acc, octet) => acc * 256 + Number(octet), 0) >>> 0;
}

/** Loopback, link-local, private, CGNAT, documentation and multicast space. */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const value = ipv4ToInt(address);
    return BLOCKED_V4_RANGES.some(([base, bits]) => {
      const size = 2 ** (32 - bits);
      return value >= ipv4ToInt(base) && value < ipv4ToInt(base) + size;
    });
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith('ff')
    );
  }
  return true;
}

/** A URL the scraper may load: http(s) only, and every address the hostname
 *  resolves to is public. Checked before the browser is started and again on
 *  every navigation request, so a redirect into a private address is refused
 *  before the request leaves the process. */
async function assertScrapableUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`unsupported URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`unsupported URL scheme: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === '') throw new Error('the URL names no host');
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new Error(`refusing a loopback, link-local or private destination: ${host}`);
    }
    return url;
  }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error(`${host} did not resolve`);
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new Error(
        `refusing a loopback, link-local or private destination: ${host} resolves to ${entry.address}`,
      );
    }
  }
  return url;
}

class Scraper {
  private static browser: any | undefined;
  private static IDLE_KILL_TIMEOUT = 30000;
  private static NAVIGATION_TIMEOUT = 20000;
  private static idleTimeout: NodeJS.Timeout | undefined;
  private static browserMutex = new Mutex();
  private static userCount = 0;

  private static async initBrowser() {
    await this.browserMutex.runExclusive(async () => {
      if (!this.browser) {
        const { chromium } = await import('playwright');
        this.browser = await chromium.launch({
          headless: true,
          channel: 'chromium-headless-shell',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
          ],
        });
      }

      if (this.idleTimeout) clearTimeout(this.idleTimeout);
    });
  }

  private static scheduleIdleKill() {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);

    this.idleTimeout = setTimeout(async () => {
      await this.browserMutex.runExclusive(async () => {
        if (this.browser && this.userCount === 0) {
          {
            await this.browser.close();
            this.browser = undefined;
          }
        }
      });
    }, this.IDLE_KILL_TIMEOUT);
  }

  static async scrape(
    url: string,
  ): Promise<{ content: string; title: string }> {
    await assertScrapableUrl(url);

    await this.initBrowser();

    if (!this.browser) throw new Error('Browser not initialized');

    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    // A redirect is a second navigation request; validate every navigation
    // before it is sent so a public URL cannot bounce the browser into a
    // loopback or private address.
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) {
        await route.continue();
        return;
      }
      try {
        await assertScrapableUrl(request.url());
        await route.continue();
      } catch {
        await route.abort('blockedbyclient');
      }
    });

    this.userCount++;

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.NAVIGATION_TIMEOUT,
      });

      await page
        .waitForLoadState('load', { timeout: 5000 })
        .catch(() => undefined);
      await page.waitForTimeout(500);

      await assertScrapableUrl(page.url());

      const html = await page.content();

      const dom = new JSDOM(html, {
        url,
      });

      const content = new Readability(dom.window.document).parse();

      const title = await page.title();

      return {
        content: `
        # ${title ?? 'No title'} - ${url}
        ${content?.textContent?.trim() ?? 'No content available'}
        `,
        title,
      };
    } catch (err) {
      console.log(`Error scraping ${url}:`, err);

      return {
        title: 'Failed to scrape',
        content: `# ${url}\n\nError scraping content.`,
      };
    } finally {
      this.userCount--;

      await context.close().catch(() => undefined);

      if (this.userCount === 0) {
        this.scheduleIdleKill();
      }
    }
  }
}

export default Scraper;

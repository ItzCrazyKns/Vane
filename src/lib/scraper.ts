import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Mutex } from 'async-mutex';
import type { Response, Route } from 'playwright';
import {
  assertPublicHttpUrl,
  isAllowedRequestUrl,
  isBlockedAddress,
} from '@/lib/security/privateNetwork';

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
    await assertPublicHttpUrl(url);

    await this.initBrowser();

    if (!this.browser) throw new Error('Browser not initialized');

    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      // Requests made by a service worker are not visible to request
      // interception, so the destination policy could be bypassed.
      serviceWorkers: 'block',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Every request this context makes, including subframes, subresources and
    // popups, is validated before it leaves the browser. Requests the browser
    // can serve itself (data:, blob:, about:) are allowed through.
    await context.route('**/*', async (route: Route) => {
      if (await isAllowedRequestUrl(route.request().url())) {
        await route.continue();
      } else {
        await route.abort('blockedbyclient');
      }
    });

    // A hostname can resolve to a public address for our check and to a
    // private one for the browser's own lookup. Record the address the
    // browser actually connected to for every response so a rebound request
    // is detected before the page content is used.
    const responseAddresses: Array<{ ipAddress: string } | null> = [];
    const addressChecks: Array<Promise<void>> = [];
    context.on('response', (response: Response) => {
      addressChecks.push(
        response
          .serverAddr()
          .then((address) => {
            responseAddresses.push(address);
          })
          .catch(() => undefined),
      );
    });

    const page = await context.newPage();

    this.userCount++;

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.NAVIGATION_TIMEOUT,
      });

      await page
        .waitForLoadState('load', { timeout: 5000 })
        .catch(() => undefined);
      await page.waitForTimeout(500);

      await assertPublicHttpUrl(page.url());

      // Do not let a response that never reports its address hang the scrape.
      await Promise.race([
        Promise.all(addressChecks),
        page.waitForTimeout(2000),
      ]);

      const documentAddress = await response?.serverAddr().catch(() => null);
      const reachedPrivate =
        responseAddresses.some(
          (address) => address && isBlockedAddress(address.ipAddress),
        ) ||
        (documentAddress && isBlockedAddress(documentAddress.ipAddress));

      if (reachedPrivate) {
        throw new Error(
          'the page was served from a loopback, link-local or private address',
        );
      }

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

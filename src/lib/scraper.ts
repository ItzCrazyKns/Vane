import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Mutex } from 'async-mutex';
import type { Response, Route, WebSocketRoute } from 'playwright';
import {
  assertPublicHttpUrl,
  isBlockedAddress,
} from '@/lib/security/privateNetwork';
import { isAllowedRequestUrl } from '@/lib/security/requestUrl';

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

    // Request interception does not see WebSocket traffic, so every socket is
    // routed separately and closed without a server connection. The scrape
    // only needs the document and its subresources.
    await context.routeWebSocket(/.*/, (webSocket: WebSocketRoute) =>
      webSocket.close().catch(() => undefined),
    );

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

    const page = await context.newPage();

    // A hostname can resolve to a public address for our check and to a
    // private one for the browser's own lookup. Record the address the
    // browser actually connected to for every response so a rebound request
    // is detected before the page content is used.
    //
    // Checks are tracked in a set that each check removes itself from, so a
    // response that arrives while the list is being awaited is still covered.
    const pendingAddressChecks = new Set<Promise<void>>();
    let blockedAddressSeen = false;
    let unverifiableResponseSeen = false;

    const recordResponseAddress = (
      address: { ipAddress?: string } | null | undefined,
    ): void => {
      if (!address || typeof address.ipAddress !== 'string') {
        // A response whose address cannot be read cannot be verified, so the
        // destination policy fails closed rather than letting it through.
        unverifiableResponseSeen = true;
        return;
      }
      if (isBlockedAddress(address.ipAddress)) blockedAddressSeen = true;
    };

    context.on('response', (response: Response) => {
      if (!/^https?:/i.test(response.url())) return;

      let check: Promise<void>;
      check = response
        .serverAddr()
        .then(recordResponseAddress)
        .catch(() => {
          unverifiableResponseSeen = true;
        })
        .finally(() => {
          pendingAddressChecks.delete(check);
        });
      pendingAddressChecks.add(check);
    });

    // Wait until every address check has settled and no new response has
    // arrived for a quiet period, so a response that lands just after the wait
    // starts is still covered. A check that outlives the budget leaves a
    // response unverified and the caller fails closed.
    const ADDRESS_QUIET_PERIOD_MS = 250;
    const drainAddressChecks = async (timeoutMs: number): Promise<boolean> => {
      const deadline = Date.now() + timeoutMs;
      let quietSince = 0;
      while (Date.now() < deadline) {
        if (pendingAddressChecks.size === 0) {
          if (quietSince === 0) {
            quietSince = Date.now();
          } else if (Date.now() - quietSince >= ADDRESS_QUIET_PERIOD_MS) {
            return true;
          }
        } else {
          quietSince = 0;
        }
        const remaining = deadline - Date.now();
        await new Promise<void>((resolve) =>
          setTimeout(resolve, Math.min(remaining, 50)),
        );
      }
      return pendingAddressChecks.size === 0;
    };

    const assertVerifiedResponseAddresses = async (timeoutMs: number) => {
      const drained = await drainAddressChecks(timeoutMs);
      if (!drained || unverifiableResponseSeen) {
        throw new Error(
          'could not verify the address every response came from',
        );
      }
      if (blockedAddressSeen) {
        throw new Error(
          'the page was served from a loopback, link-local or private address',
        );
      }
    };

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

      // Check the navigation response directly as well as through the
      // context listener, so a navigation that skipped the listener cannot
      // bypass the destination policy.
      const documentAddress = await response?.serverAddr().catch(() => null);
      recordResponseAddress(documentAddress);

      await assertVerifiedResponseAddresses(5000);

      const html = await page.content();

      const dom = new JSDOM(html, {
        url,
      });

      const content = new Readability(dom.window.document).parse();

      const title = await page.title();

      // Responses can still arrive while the content is read. Drain and check
      // once more before returning so no private response is used.
      await assertVerifiedResponseAddresses(2000);

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

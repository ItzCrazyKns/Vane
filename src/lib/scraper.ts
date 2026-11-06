import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { getFirecrawlConfig, firecrawlHeaders } from './firecrawl';

type ScrapeResult = { content: string; title: string };

type FirecrawlScrapeResponse = {
  success?: boolean;
  error?: string;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string | string[];
      statusCode?: number;
      error?: string;
    };
  };
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

/**
 * Reads web pages for the researcher.
 *
 * When a Firecrawl URL is configured (Settings > Search, or
 * `FIRECRAWL_API_URL`), pages are fetched through Firecrawl's
 * `/v2/scrape` endpoint as markdown. Otherwise a plain `fetch` + Readability
 * fallback is used (no JavaScript execution).
 *
 * `scrape` never throws: a failed page returns a "Failed to scrape" result so
 * the caller can carry on with the other pages.
 */
class Scraper {
  /** Time Firecrawl is allowed to spend on a page (sent in the request). */
  static FIRECRAWL_TIMEOUT_MS = 60000;
  /** Extra time we wait for Firecrawl's HTTP response on top of its own timeout. */
  private static FIRECRAWL_RESPONSE_GRACE_MS = 5000;
  /** Timeout for the fetch + Readability fallback. */
  static FETCH_TIMEOUT_MS = 20000;

  static async scrape(url: string): Promise<ScrapeResult> {
    try {
      const firecrawl = getFirecrawlConfig();

      if (firecrawl) {
        return await this.scrapeWithFirecrawl(
          url,
          firecrawl.apiURL,
          firecrawl.apiKey,
        );
      }

      return await this.scrapeWithFetch(url);
    } catch (err: any) {
      const reason =
        err?.name === 'AbortError' || err?.name === 'TimeoutError'
          ? 'timed out'
          : err?.message || String(err);

      console.log(`Error scraping ${url}: ${reason}`);

      return {
        title: 'Failed to scrape',
        content: `# ${url}\n\nError scraping content.`,
      };
    }
  }

  private static async scrapeWithFirecrawl(
    url: string,
    apiURL: string,
    apiKey?: string,
  ): Promise<ScrapeResult> {
    const res = await fetch(`${apiURL}/v2/scrape`, {
      method: 'POST',
      headers: firecrawlHeaders(apiKey),
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        timeout: this.FIRECRAWL_TIMEOUT_MS,
      }),
      signal: AbortSignal.timeout(
        this.FIRECRAWL_TIMEOUT_MS + this.FIRECRAWL_RESPONSE_GRACE_MS,
      ),
    });

    const body = (await res
      .json()
      .catch(() => null)) as FirecrawlScrapeResponse | null;

    if (!res.ok || !body?.success) {
      throw new Error(
        `Firecrawl returned ${res.status}${body?.error ? `: ${body.error}` : ''}`,
      );
    }

    const markdown = body.data?.markdown?.trim();

    if (!markdown) {
      throw new Error('Firecrawl returned no markdown content');
    }

    const rawTitle = body.data?.metadata?.title;
    const title =
      (Array.isArray(rawTitle) ? rawTitle[0] : rawTitle)?.trim() || url;

    return {
      content: `# ${title} - ${url}\n\n${markdown}`,
      title,
    };
  }

  private static async scrapeWithFetch(url: string): Promise<ScrapeResult> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType && !/html|xml|text\/|json/i.test(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const raw = await res.text();

    if (contentType && !/html|xml/i.test(contentType)) {
      const text = raw.trim();
      if (!text) throw new Error('Empty response');

      return {
        content: `# ${url} - ${url}\n\n${text}`,
        title: url,
      };
    }

    const dom = new JSDOM(raw, { url: res.url || url });

    try {
      const pageTitle = dom.window.document.title?.trim();
      const article = new Readability(dom.window.document).parse();
      const title = article?.title?.trim() || pageTitle || url;
      const text = article?.textContent?.trim();

      return {
        content: `# ${title} - ${url}\n\n${text || 'No content available'}`,
        title,
      };
    } finally {
      dom.window.close();
    }
  }
}

export default Scraper;

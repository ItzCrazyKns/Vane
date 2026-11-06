/* Record/replay for the two external sources the search agent reads:
   SearxNG (via a local HTTP stand-in) and page scraping (by wrapping
   Scraper.scrape). In "record" mode both go to the real service and the
   answers are written to perf-audit/fixtures/eval/. In "replay" mode only
   the recorded answers are served, so a change under test is the only
   thing that can move the result. A request that was never recorded is
   logged as a miss and answered with an empty result (SearxNG) or the
   scraper's own failure shape (pages). */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export type ReplayMode = 'record' | 'replay';

export type MissLog = { searxng: string[]; pages: string[] };

const sha = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);

/* Key = the search params Vane sends, sorted, without format=json. */
export const searxngKey = (params: URLSearchParams) => {
  const entries = [...params.entries()]
    .filter(([k]) => k !== 'format')
    .sort(([a, av], [b, bv]) =>
      a === b ? av.localeCompare(bv) : a.localeCompare(b),
    );
  return sha(JSON.stringify(entries));
};

export const pageKey = (url: string) => sha(url);

export class SearxngReplayServer {
  private server: http.Server | undefined;
  readonly misses: string[] = [];
  readonly hits: string[] = [];

  constructor(
    private opts: {
      mode: ReplayMode;
      fixturesDir: string;
      upstreamURL?: string;
    },
  ) {
    fs.mkdirSync(opts.fixturesDir, { recursive: true });
    if (opts.mode === 'record' && !opts.upstreamURL) {
      throw new Error(
        'record mode needs the real SearxNG URL (EVAL_SEARXNG_UPSTREAM)',
      );
    }
  }

  async start(): Promise<string> {
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      });
    });
    await new Promise<void>((resolve) =>
      this.server!.listen(0, '127.0.0.1', () => resolve()),
    );
    const addr = this.server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    return `http://127.0.0.1:${addr.port}`;
  }

  async stop() {
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://local');
    const key = searxngKey(url.searchParams);
    const file = path.join(this.opts.fixturesDir, `${key}.json`);
    const label = url.searchParams.toString();

    if (fs.existsSync(file)) {
      this.hits.push(label);
      const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(saved.response));
      return;
    }

    if (this.opts.mode === 'replay') {
      this.misses.push(label);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ results: [], suggestions: [] }));
      return;
    }

    const upstream = new URL(`${this.opts.upstreamURL}/search`);
    url.searchParams.forEach((v, k) => upstream.searchParams.append(k, v));
    const upstreamRes = await fetch(upstream, {
      headers: { 'X-Forwarded-For': '127.0.0.1', 'X-Real-IP': '127.0.0.1' },
    });
    const body = await upstreamRes.json();
    /* Keep only what Vane reads, so fixtures stay small and diffable. */
    const response = {
      results: (body.results ?? []).map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        img_src: r.img_src,
        thumbnail_src: r.thumbnail_src,
        thumbnail: r.thumbnail,
        author: r.author,
        iframe_src: r.iframe_src,
      })),
      suggestions: body.suggestions ?? [],
    };
    fs.writeFileSync(
      file,
      JSON.stringify(
        { request: Object.fromEntries(url.searchParams), response },
        null,
        2,
      ),
    );
    this.hits.push(label);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(response));
  }
}

type ScrapeFn = (url: string) => Promise<{ content: string; title: string }>;

/* Wraps Scraper.scrape in place. Returns the list of missed URLs. */
export const patchScraper = (
  scraper: { scrape: ScrapeFn },
  opts: { mode: ReplayMode; fixturesDir: string },
) => {
  fs.mkdirSync(opts.fixturesDir, { recursive: true });
  const original = scraper.scrape.bind(scraper);
  const misses: string[] = [];

  scraper.scrape = async (url: string) => {
    const file = path.join(opts.fixturesDir, `${pageKey(url)}.json`);
    if (fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return { title: saved.title, content: saved.content };
    }
    if (opts.mode === 'replay') {
      misses.push(url);
      /* Same shape Scraper.scrape returns when a page fails to load. */
      return {
        title: 'Failed to scrape',
        content: `# ${url}\n\nError scraping content.`,
      };
    }
    const out = await original(url);
    fs.writeFileSync(
      file,
      JSON.stringify({ url, title: out.title, content: out.content }, null, 2),
    );
    return out;
  };

  return { misses, restore: () => (scraper.scrape = original) };
};

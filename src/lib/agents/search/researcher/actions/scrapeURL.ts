import { Chunk, ReadingResearchBlock } from '@/lib/types';
import dns from 'node:dns/promises';
import net from 'node:net';
import TurnDown from 'turndown';
import z from 'zod';
import { ResearchAction } from '../../types';

const turndownService = new TurnDown();
const MAX_REDIRECTS = 5;
const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.localdomain',
  '.internal',
  '.lan',
  '.home.arpa',
];

const schema = z.object({
  urls: z.array(z.string()).describe('A list of URLs to scrape content from.'),
});

const actionDescription = `
Use this tool to scrape and extract content from the provided URLs. This is useful when you the user has asked you to extract or summarize information from specific web pages. You can provide up to 3 URLs at a time. NEVER CALL THIS TOOL EXPLICITLY YOURSELF UNLESS INSTRUCTED TO DO SO BY THE USER.
You should only call this tool when the user has specifically requested information from certain web pages, never call this yourself to get extra information without user instruction.

For example, if the user says "Please summarize the content of https://example.com/article", you can call this tool with that URL to get the content and then provide the summary or "What does X mean according to https://example.com/page", you can call this tool with that URL to get the content and provide the explanation.
`;

const normalizeAddress = (address: string) =>
  address
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0];

const isBlockedIPv4 = (address: string): boolean => {
  const octets = address.split('.').map((part) => Number.parseInt(part, 10));

  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

const isBlockedIPv6 = (address: string): boolean => {
  const normalized = normalizeAddress(address);

  if (normalized === '::1' || normalized === '::') {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    return isBlockedIPAddress(normalized.slice('::ffff:'.length));
  }

  return (
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
};

const isBlockedIPAddress = (address: string): boolean => {
  const normalized = normalizeAddress(address);
  const version = net.isIP(normalized);

  if (version === 4) {
    return isBlockedIPv4(normalized);
  }

  if (version === 6) {
    return isBlockedIPv6(normalized);
  }

  return false;
};

const isBlockedHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();

  return (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
};

const assertSafeScrapeURL = async (rawURL: string): Promise<URL> => {
  let parsed: URL;

  try {
    parsed = new URL(rawURL);
  } catch {
    throw new Error(`Invalid URL: ${rawURL}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(
      `Unsupported URL protocol for scraping: ${parsed.protocol}`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isBlockedHostname(hostname) || isBlockedIPAddress(hostname)) {
    throw new Error(
      `Refusing to access local or private network URL: ${rawURL}`,
    );
  }

  try {
    const resolved = await dns.lookup(hostname, { all: true, verbatim: true });

    if (resolved.some((entry) => isBlockedIPAddress(entry.address))) {
      throw new Error(
        `Refusing to access local or private network URL: ${rawURL}`,
      );
    }
  } catch (error: any) {
    if (
      error instanceof Error &&
      error.message.startsWith(
        'Refusing to access local or private network URL:',
      )
    ) {
      throw error;
    }
  }

  return parsed;
};

const fetchScrapeURL = async (
  rawURL: string,
  redirectCount = 0,
): Promise<Response> => {
  const safeURL = await assertSafeScrapeURL(rawURL);
  const res = await fetch(safeURL, { redirect: 'manual' });

  if (res.status >= 300 && res.status < 400) {
    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error(`Too many redirects while scraping ${rawURL}`);
    }

    const location = res.headers.get('location');

    if (!location) {
      throw new Error(`Redirect missing location while scraping ${rawURL}`);
    }

    const redirectedURL = new URL(location, safeURL).toString();
    return fetchScrapeURL(redirectedURL, redirectCount + 1);
  }

  return res;
};

const scrapeURLAction: ResearchAction<typeof schema> = {
  name: 'scrape_url',
  schema: schema,
  getToolDescription: () =>
    'Use this tool to scrape and extract content from the provided URLs. This is useful when you the user has asked you to extract or summarize information from specific web pages. You can provide up to 3 URLs at a time. NEVER CALL THIS TOOL EXPLICITLY YOURSELF UNLESS INSTRUCTED TO DO SO BY THE USER.',
  getDescription: () => actionDescription,
  enabled: (_) => true,
  execute: async (params, additionalConfig) => {
    params.urls = params.urls.slice(0, 3);

    let readingBlockId = crypto.randomUUID();
    let readingEmitted = false;

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    const results: Chunk[] = [];

    await Promise.all(
      params.urls.map(async (url) => {
        try {
          const res = await fetchScrapeURL(url);
          const text = await res.text();

          const title =
            text.match(/<title>(.*?)<\/title>/i)?.[1] || `Content from ${url}`;

          if (
            !readingEmitted &&
            researchBlock &&
            researchBlock.type === 'research'
          ) {
            readingEmitted = true;
            researchBlock.data.subSteps.push({
              id: readingBlockId,
              type: 'reading',
              reading: [
                {
                  content: '',
                  metadata: {
                    url,
                    title: title,
                  },
                },
              ],
            });

            additionalConfig.session.updateBlock(
              additionalConfig.researchBlockId,
              [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: researchBlock.data.subSteps,
                },
              ],
            );
          } else if (
            readingEmitted &&
            researchBlock &&
            researchBlock.type === 'research'
          ) {
            const subStepIndex = researchBlock.data.subSteps.findIndex(
              (step: any) => step.id === readingBlockId,
            );

            const subStep = researchBlock.data.subSteps[
              subStepIndex
            ] as ReadingResearchBlock;

            subStep.reading.push({
              content: '',
              metadata: {
                url,
                title: title,
              },
            });

            additionalConfig.session.updateBlock(
              additionalConfig.researchBlockId,
              [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: researchBlock.data.subSteps,
                },
              ],
            );
          }

          const markdown = turndownService.turndown(text);

          results.push({
            content: markdown,
            metadata: {
              url,
              title: title,
            },
          });
        } catch (error) {
          results.push({
            content: `Failed to fetch content from ${url}: ${error}`,
            metadata: {
              url,
              title: `Error fetching ${url}`,
            },
          });
        }
      }),
    );

    return {
      type: 'search_results',
      results,
    };
  },
};

export default scrapeURLAction;

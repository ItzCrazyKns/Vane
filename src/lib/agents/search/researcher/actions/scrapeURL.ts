import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk, ReadingResearchBlock } from '@/lib/types';
import TurnDown from 'turndown';

const turndownService = new TurnDown();

/**
 * Validates URLs to prevent Server-Side Request Forgery (SSRF) attacks.
 * Blocks internal IP ranges, localhost, and non-HTTP/HTTPS protocols.
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Block internal/private IP ranges and localhost
    const hostname = url.hostname.toLowerCase();
    const blockedPatterns = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^0\./,
      /^::1$/,
      /^fc00:/i, // IPv6 unique local
      /^fe80:/i, // IPv6 link-local
    ];

    if (blockedPatterns.some((pattern) => pattern.test(hostname))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  urls: z.array(z.string()).describe('A list of URLs to scrape content from.'),
});

const actionDescription = `
Use this tool to scrape and extract content from the provided URLs. This is useful when you the user has asked you to extract or summarize information from specific web pages. You can provide up to 3 URLs at a time. NEVER CALL THIS TOOL EXPLICITLY YOURSELF UNLESS INSTRUCTED TO DO SO BY THE USER.
You should only call this tool when the user has specifically requested information from certain web pages, never call this yourself to get extra information without user instruction.

For example, if the user says "Please summarize the content of https://example.com/article", you can call this tool with that URL to get the content and then provide the summary or "What does X mean according to https://example.com/page", you can call this tool with that URL to get the content and provide the explanation.
`;

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
          // Validate URL to prevent SSRF attacks
          if (!isValidUrl(url)) {
            results.push({
              content: `Access to URL ${url} is not allowed for security reasons.`,
              metadata: {
                url,
                title: `Blocked: ${url}`,
              },
            });
            return;
          }

          const res = await fetch(url);
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

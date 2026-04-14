import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk, ReadingResearchBlock } from '@/lib/types';
import Scraper from '@/lib/scraper';
import { splitText } from '@/lib/utils/splitText';

const extractorPrompt = `
                  Assistant is an AI information extractor. Assistant will be shared with scraped information from a website along with the queries used to retrieve that information. Assistant's task is to extract relevant facts from the scraped data to answer the queries.
            
                  ## Things to taken into consideration when extracting information:
                  1. Relevance to the query: The extracted information must dynamically adjust based on the query's intent. If the query asks "What is [X]", you must extract the definition/identity. If the query asks for "[X] specs" or "features", you must provide deep, granular technical details.
                     - Example: For "What is [Product]", extract the core definition. For "[Product] capabilities", extract every technical function mentioned.
                  2. Concentrate on extracting factual information that can help in answering the question rather than opinions or commentary. Ignore marketing fluff like "best-in-class" or "seamless."
                  3. Noise to signal ratio: If the scraped data is noisy (headers, footers, UI text), ignore it and extract only the high-value information. 
                     - Example: Discard "Click for more" or "Subscribe now" messages.
                  4. Avoid using filler sentences or words; extract concise, telegram-style information.
                     - Example: Change "The device features a weight of only 1.2kg" to "Weight: 1.2kg."
                  5. Duplicate information: If a fact appears multiple times (e.g., in a paragraph and a technical table), merge the details into a single, high-density bullet point to avoid redundancy.
                  6. Numerical Data Integrity: NEVER summarize or generalize numbers, benchmarks, or table data. Extract raw values exactly as they appear.
                     - Example: Do not say "Improved coding scores." Say "LiveCodeBench v6: 80.0%."
            
                  ## Example
                  For example, if the query is "What are the health benefits of green tea?" and the scraped data contains various pieces of information about green tea, Assistant should focus on extracting factual information related to the health benefits of green tea such as "Green tea contains antioxidants which can help in reducing inflammation" and ignore irrelevant information such as "Green tea is a popular beverage worldwide".
                  
                  It can also remove filler words to reduce the sentence to "Contains antioxidants; reduces inflammation." 
                  
                  For tables/numerical data extraction, Assistant should extract the raw numerical data or the content of the table without trying to summarize it to avoid losing important details. For example, if a table lists specific battery life hours for different modes, Assistant should list every mode and its corresponding hour count rather than giving a general average.
                  
                  Make sure the extracted facts are in bullet points format to make it easier to read and understand.
            
                  ## Output format
                  Assistant should reply with a JSON object containing a key "extracted_facts" which is a string of the bulleted facts. Return only raw JSON without markdown formatting (no \`\`\`json blocks).
            
                  <example_output>
                  {
                    "extracted_facts": "- Fact 1\n- Fact 2\n- Fact 3"
                  }
                  </example_output>
                  `;

const extractorSchema = z.object({
  extracted_facts: z
    .string()
    .describe(
      'The extracted facts that are relevant to the query and can help in answering the question should be listed here in a concise manner.',
    ),
});

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
    params.urls = (params.urls ?? []).slice(0, 3);

    let readingBlockId = crypto.randomUUID();
    let readingEmitted = false;

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    const results: Chunk[] = [];

    await Promise.all(
      params.urls.map(async (url) => {
        try {
          const scraped = await Scraper.scrape(url);

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
                    title: scraped.title,
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
                title: scraped.title,
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

          const chunks = splitText(scraped.content, 4000, 500);

          let accumulatedContent = '';

          if (chunks.length > 1) {
            try {
              await Promise.all(
                chunks.map(async (chunk) => {
                  const extracted = await additionalConfig.llm.generateObject<
                    typeof extractorSchema
                  >({
                    messages: [
                      {
                        role: 'system',
                        content: extractorPrompt,
                      },
                      {
                        role: 'user',
                        content: `<queries>Summarize</queries>\n<scraped_data>${chunk}</scraped_data>`,
                      },
                    ],
                    schema: extractorSchema,
                  });

                  accumulatedContent += extracted.extracted_facts + '\n';
                }),
              );
            } catch (err) {
              console.log(
                'Error during extraction, falling back to raw content',
                err,
              );
              accumulatedContent = chunks[0];
            }
          } else {
            accumulatedContent = scraped.content;
          }

          results.push({
            content: accumulatedContent,
            metadata: {
              url,
              title: scraped.title,
            },
          });
        } catch (error) {
          results.push({
            content: `Failed to fetch content from ${url}: ${error}`,
            metadata: {
              url,
              title: `Error scraping ${url}`,
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

import BaseEmbedding from '@/lib/models/base/embedding';
import BaseLLM from '@/lib/models/base/llm';
import { searchSearxng, SearxngSearchOptions } from '@/lib/searxng';
import SessionManager from '@/lib/session';
import { Chunk, ResearchBlock, SearchResultsResearchBlock } from '@/lib/types';
import { SearchAgentConfig } from '../../../types';
import computeSimilarity from '@/lib/utils/computeSimilarity';
import z from 'zod';
import Scraper from '@/lib/scraper';
import { splitText } from '@/lib/utils/splitText';
import { normalizeUrl } from '@/lib/utils/normalizeUrl';

export const executeSearch = async (input: {
  queries: string[];
  mode: SearchAgentConfig['mode'];
  searchConfig?: SearxngSearchOptions;
  researchBlock: ResearchBlock;
  session: InstanceType<typeof SessionManager>;
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
}) => {
  const researchBlock = input.researchBlock;

  researchBlock.data.subSteps.push({
    id: crypto.randomUUID(),
    type: 'searching',
    searching: input.queries,
  });

  input.session.updateBlock(researchBlock.id, [
    {
      op: 'replace',
      path: '/data/subSteps',
      value: researchBlock.data.subSteps,
    },
  ]);

  if (input.mode === 'speed' || input.mode === 'balanced') {
    const searchResultsBlockId = crypto.randomUUID();
    let searchResultsEmitted = false;

    const results: Chunk[] = [];

    const search = async (q: string) => {
      const res = await searchSearxng(q, {
        ...(input.searchConfig ? input.searchConfig : {}),
      });

      let resultChunks: Chunk[] = [];

      try {
        const queryEmbedding = (await input.embedding.embedText([q]))[0];

        resultChunks = (
          await Promise.all(
            res.results.map(async (r) => {
              const content = r.content || r.title;
              const chunkEmbedding = (
                await input.embedding.embedText([content])
              )[0];

              return {
                content,
                metadata: {
                  title: r.title,
                  url: r.url,
                  similarity: computeSimilarity(queryEmbedding, chunkEmbedding),
                  embedding: chunkEmbedding,
                },
              };
            }),
          )
        ).filter((c) => c.metadata.similarity > 0.5);
      } catch (err) {
        resultChunks = res.results.map((r) => {
          const content = r.content || r.title;

          return {
            content,
            metadata: {
              title: r.title,
              url: r.url,
              similarity: 1,
              embedding: [],
            },
          };
        });
      } finally {
        results.push(...resultChunks);
      }

      if (!searchResultsEmitted) {
        searchResultsEmitted = true;

        researchBlock.data.subSteps.push({
          id: searchResultsBlockId,
          type: 'search_results',
          reading: resultChunks,
        });

        input.session.updateBlock(researchBlock.id, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      } else if (searchResultsEmitted) {
        const subStepIndex = researchBlock.data.subSteps.findIndex(
          (step) => step.id === searchResultsBlockId,
        );

        const subStep = researchBlock.data.subSteps[
          subStepIndex
        ] as SearchResultsResearchBlock;

        subStep.reading.push(...resultChunks);

        input.session.updateBlock(researchBlock.id, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      }
    };

    await Promise.all(input.queries.map(search));

    results.sort((a, b) => b.metadata.similarity - a.metadata.similarity);

    const uniqueSearchResultIndices: Set<number> = new Set();

    for (let i = 0; i < results.length; i++) {
      let isDuplicate = false;

      for (const indice of uniqueSearchResultIndices.keys()) {
        if (
          results[i].metadata.embedding.length === 0 ||
          results[indice].metadata.embedding.length === 0
        )
          continue;

        const similarity = computeSimilarity(
          results[i].metadata.embedding,
          results[indice].metadata.embedding,
        );

        if (similarity > 0.75) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueSearchResultIndices.add(i);
      }
    }

    const uniqueSearchResults = Array.from(uniqueSearchResultIndices.keys())
      .map((i) => {
        const uniqueResult = results[i];

        delete uniqueResult.metadata.embedding;
        delete uniqueResult.metadata.similarity;

        return uniqueResult;
      })
      .slice(0, 20);

    return uniqueSearchResults;
  } else if (input.mode === 'quality') {
    const searchResultsBlockId = crypto.randomUUID();
    let searchResultsEmitted = false;

    const searchResults: Chunk[] = [];

    const search = async (q: string) => {
      const res = await searchSearxng(q, {
        ...(input.searchConfig ? input.searchConfig : {}),
      });

      let resultChunks: Chunk[] = [];

      resultChunks = res.results.map((r) => {
        const content = r.content || r.title;

        return {
          content,
          metadata: {
            title: r.title,
            url: r.url,
            similarity: 1,
            embedding: [],
          },
        };
      });

      searchResults.push(...resultChunks);

      if (!searchResultsEmitted) {
        searchResultsEmitted = true;

        researchBlock.data.subSteps.push({
          id: searchResultsBlockId,
          type: 'search_results',
          reading: resultChunks,
        });

        input.session.updateBlock(researchBlock.id, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      } else if (searchResultsEmitted) {
        const subStepIndex = researchBlock.data.subSteps.findIndex(
          (step) => step.id === searchResultsBlockId,
        );

        const subStep = researchBlock.data.subSteps[
          subStepIndex
        ] as SearchResultsResearchBlock;

        subStep.reading.push(...resultChunks);

        input.session.updateBlock(researchBlock.id, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      }
    };

    await Promise.all(input.queries.map(search));

    const pickerPrompt = `
      Assistant is an AI search result picker. Assistant's task is to pick 2-3 of the most relevant search results based off the query which can be then scraped for information to answer the query.
      Assistant will be shared with the search results retrieved from a search engine along with the queries used to retrieve those results. Assistant will then pick maxiumum 3 of the most relevant search results based on the queries and the content of the search results. Assistant should only pick search results that are relevant to the query and can help in answering the question.
      
      ## Things to taken into consideration when picking the search results:
      1. Relevance to the query: The search results should be relevant to the query provided. Irrelevant results should be ignored.
      2. Content quality: The content of the search results should be of high quality and provide valuable information that can help in answering the question.
      3. Favour known and reputable sources: If there are search results from known and reputable sources that are relevant to the query, those should be prioritized.
      4. Diversity: If there are multiple search results that are relevant and of high quality, try to pick results that provide diverse perspectives or information to get a well-rounded understanding of the topic.
      5. Avoid picking search results that are too similar to each other in terms of content to maximize the amount of information gathered.
      6. Maximum 3 results: Assistant should pick a maximum of 3 search results. If there are more than 3 relevant and high-quality search results, pick the top 3 based on the above criteria. If the queries are very specific and there are only 1 or 2 relevant search results, it's okay to pick only those 1 or 2 results.
      7. Try to pick only one high quality result unless there are diverse perspective in multiple results then you can pick a maximum of 3.
      8. Analyze the title, the snippet and the URL to determine the relevant to query, quality of the content that might be present inside and the reputation of the source before picking the search result.
      
      ## Output format
      Assistant should output an array of indices corresponding to the search results that were picked based on the above criteria. The indices should be based on the order of the search results provided to Assistant. For example, if Assistant picks the 1st, 3rd, and 5th search results, Assistant should output [0, 2, 4].
      
      <example_output>
      {
       "picked_indices": [0,2,4]
      }
      </example_output>
      `;

    const pickerSchema = z.object({
      picked_indices: z
        .array(z.number())
        .describe(
          'The array of the picked indices to be scraped for answering',
        ),
    });

    const pickerResponse = await input.llm.generateObject<typeof pickerSchema>({
      schema: pickerSchema,
      messages: [
        {
          role: 'system',
          content: pickerPrompt,
        },
        {
          role: 'user',
          content: `<queries>${input.queries.join(', ')}</queries>\n<search_results>${searchResults.map((result, index) => `<result indice=${index}>${JSON.stringify(result)}</result>`).join('\n')}</search_results>`,
        },
      ],
    });

    const pickedIndices = pickerResponse.picked_indices.slice(0, 3);
    const pickedResults = pickedIndices
      .map((i) => searchResults[i])
      .filter((r) => r !== undefined);

    /* Normalised keys so tracking-param, http/https and trailing-slash
       variants of a page that was already read are not read again. */
    const alreadyExtractedURLs = new Set<string>();

    researchBlock.data.subSteps.forEach((step) => {
      if (step.type === 'reading') {
        step.reading.forEach((chunk) => {
          alreadyExtractedURLs.add(normalizeUrl(chunk.metadata.url));
        });
      }
    });

    const filteredResults = pickedResults.filter(
      (r) => !alreadyExtractedURLs.has(normalizeUrl(r.metadata.url)),
    );

    if (filteredResults.length > 0) {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'reading',
        reading: filteredResults,
      });

      input.session.updateBlock(researchBlock.id, [
        {
          path: '/data/subSteps',
          op: 'replace',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    const extractedFacts: Chunk[] = [];

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

    await Promise.all(
      filteredResults.map(async (result, i) => {
        try {
          const scrapedData = await Scraper.scrape(result.metadata.url).catch(
            (err) => {
              console.log('Error scraping data from', result.metadata.url, err);
            },
          );

          if (!scrapedData) return;

          let accumulatedContent = '';
          const chunks = splitText(scrapedData.content, 4000, 500);

          await Promise.all(
            chunks.map(async (chunk) => {
              try {
                const extractorOutput = await input.llm.generateObject<
                  typeof extractorSchema
                >({
                  schema: extractorSchema,
                  messages: [
                    {
                      role: 'system',
                      content: extractorPrompt,
                    },
                    {
                      role: 'user',
                      content: `<queries>${input.queries.join(', ')}</queries>\n<scraped_data>${chunk}</scraped_data>`,
                    },
                  ],
                });

                accumulatedContent += extractorOutput.extracted_facts + '\n';
              } catch (err) {
                console.log('Error extracting information from chunk', err);
              }
            }),
          );

          extractedFacts.push({
            ...result,
            content: accumulatedContent,
          });
        } catch (err) {
          console.log(
            'Error scraping or extracting information from',
            result.metadata.url,
            err,
          );
        }
      }),
    );

    return extractedFacts;
  } else {
    return [];
  }
};

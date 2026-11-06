import z from 'zod';
import { ResearchAction } from '../../../types';
import { ResearchBlock } from '@/lib/types';
import { executeSearch } from './baseSearch';
import { getEffort } from '../../../effort';
import { NO_NEW_QUERIES_NOTE, normalizeQueries } from './queries';
import {
  FILTERS_TOOL_GUIDE,
  RECENCY_VALUES,
  hasFilters,
  parseSearchFilters,
} from './filters';

const actionSchema = z.object({
  type: z.literal('web_search'),
  queries: z
    .array(z.string())
    .describe('An array of search queries to perform web searches for.'),
  recency: z
    .enum(RECENCY_VALUES)
    .optional()
    .describe(
      'Optional. Only return results published in the last day, week, month or year.',
    ),
  domains: z
    .array(z.string())
    .optional()
    .describe(
      'Optional. Domains to restrict results to (e.g. "gov.br"), or to exclude when prefixed with "-" (e.g. "-pinterest.com").',
    ),
  language: z
    .string()
    .optional()
    .describe(
      'Optional. Two-letter ISO 639-1 code of the pages to search (e.g. "pt", "en").',
    ),
});

const speedModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.
You are currently on speed mode, meaning you would only get to call this tool once. Make sure to prioritize the most important queries that are likely to get you the needed information in one go.

Your queries should be very targeted and specific to the information you need, avoid broad or generic queries.
Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

For example, if the user is asking about the features of a new technology, you might use queries like "GPT-5.1 features", "GPT-5.1 release date", "GPT-5.1 improvements" rather than a broad query like "Tell me about GPT-5.1".

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information.
`;

const balancedModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.

You can call this tool several times if needed to gather enough information.
Start initially with broader queries to get an overview, then narrow down with more specific queries based on the results you receive.

Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

For example if the user is asking about Tesla, your actions should be like:
1. __reasoning_preamble "The user is asking about Tesla. I will start with broader queries to get an overview of Tesla, then narrow down with more specific queries based on the results I receive." then
2. web_search ["Tesla", "Tesla latest news", "Tesla stock price"] then
3. __reasoning_preamble "Based on the previous search results, I will now narrow down my queries to focus on Tesla's recent developments and stock performance." then
4. web_search ["Tesla Q2 2025 earnings", "Tesla new model 2025", "Tesla stock analysis"] then done.
5. __reasoning_preamble "I have gathered enough information to provide a comprehensive answer."
6. done.

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information. You can call this tools, multiple times as needed.
`;

const qualityModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.

You have to call this tool several times to gather enough information unless the question is very simple (like greeting questions or basic facts).
Start initially with broader queries to get an overview, then narrow down with more specific queries based on the results you receive.
Never stop before at least 5-6 iterations of searches unless the user question is very simple.

Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information. You can call this tools, multiple times as needed.
`;

const webSearchAction: ResearchAction<typeof actionSchema> = {
  name: 'web_search',
  schema: actionSchema,
  getToolDescription: () =>
    "Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.",
  getDescription: (config) => {
    let prompt = '';

    switch (config.mode) {
      case 'speed':
        prompt = speedModePrompt;
        break;
      case 'balanced':
        prompt = balancedModePrompt;
        break;
      case 'quality':
        prompt = qualityModePrompt;
        break;
      default:
        prompt = speedModePrompt;
        break;
    }

    return prompt + FILTERS_TOOL_GUIDE;
  },
  enabled: (config) =>
    config.sources.includes('web') &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    ) as ResearchBlock | undefined;

    if (!researchBlock) throw new Error('Failed to retrieve research block');

    const queries = normalizeQueries(input.queries, researchBlock);

    if (queries.length === 0) {
      return {
        type: 'search_results',
        results: [],
        note: NO_NEW_QUERIES_NOTE,
      };
    }

    /* Filters are optional and validated loosely: a bad value is dropped
       rather than failing the search. */
    const filters = parseSearchFilters(input as Record<string, unknown>);

    const results = await executeSearch({
      llm: additionalConfig.llm,
      embedding: additionalConfig.embedding,
      mode: additionalConfig.mode,
      queries,
      question: additionalConfig.question,
      researchBlock: researchBlock,
      session: additionalConfig.session,
      filters: hasFilters(filters) ? filters : undefined,
      /* Balanced reads the best passages of its top pages; speed stays
         on snippets, quality already reads pages with the extractor. */
      readPages: getEffort(additionalConfig.mode).readPages,
    });

    return {
      type: 'search_results',
      results: results,
    };
  },
};

export default webSearchAction;

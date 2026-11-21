import z from 'zod';
import { ResearchAction } from '../../../types';
import { executeSearch } from './baseSearch';

const schema = z.object({
  queries: z.array(z.string()).describe('Up to three Stack Overflow queries'),
});

const description =
  'Search Stack Overflow for programming questions, debugging advice, and code examples. Use up to three focused queries with language names, APIs, or exact error messages. Use this tool when Stack Overflow is requested or relevant.';

const stackOverflowSearchAction: ResearchAction<typeof schema> = {
  name: 'stackoverflow_search',
  schema,
  getDescription: () => description,
  getToolDescription: () => description,
  enabled: (config) =>
    config.sources.includes('stackoverflow') &&
    !config.classification.classification.skipSearch,
  execute: async (input, config) => {
    const queries = (
      Array.isArray(input.queries) ? input.queries : [input.queries]
    ).slice(0, 3);
    const researchBlock = config.session.getBlock(config.researchBlockId);

    if (researchBlock?.type !== 'research') {
      throw new Error('Failed to retrieve research block');
    }

    const results = await executeSearch({
      llm: config.llm,
      embedding: config.embedding,
      mode: config.mode,
      queries,
      researchBlock,
      session: config.session,
      searchConfig: { engines: ['stackoverflow'] },
      source: 'stackoverflow',
    });

    return { type: 'search_results', results };
  },
};

export default stackOverflowSearchAction;

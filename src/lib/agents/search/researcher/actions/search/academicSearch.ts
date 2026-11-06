import z from 'zod';
import { ResearchAction } from '../../../types';
import { ResearchBlock } from '@/lib/types';
import { executeSearch } from './baseSearch';
import { NO_NEW_QUERIES_NOTE, normalizeQueries } from './queries';

const schema = z.object({
  queries: z.array(z.string()).describe('List of academic search queries'),
});

const academicSearchDescription = `
Use this tool to perform academic searches for scholarly articles, papers, and research studies relevant to the user's query. Provide a list of concise search queries that will help gather comprehensive academic information on the topic at hand.
You can provide up to 3 queries at a time. Make sure the queries are specific and relevant to the user's needs.

For example, if the user is interested in recent advancements in renewable energy, your queries could be:
1. "Recent advancements in renewable energy 2024"
2. "Cutting-edge research on solar power technologies"
3. "Innovations in wind energy systems"

If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed academic information.
`;

const academicSearchAction: ResearchAction<typeof schema> = {
  name: 'academic_search',
  schema: schema,
  getDescription: () => academicSearchDescription,
  getToolDescription: () =>
    "Use this tool to perform academic searches for scholarly articles, papers, and research studies relevant to the user's query. Provide a list of concise search queries that will help gather comprehensive academic information on the topic at hand.",
  enabled: (config) =>
    config.sources.includes('academic') &&
    config.classification.classification.skipSearch === false &&
    config.classification.classification.academicSearch === true,
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

    const results = await executeSearch({
      llm: additionalConfig.llm,
      embedding: additionalConfig.embedding,
      mode: additionalConfig.mode,
      queries,
      question: additionalConfig.question,
      researchBlock: researchBlock,
      session: additionalConfig.session,
      searchConfig: {
        engines: ['arxiv', 'google scholar', 'pubmed'],
      },
    });

    return {
      type: 'search_results',
      results: results,
    };
  },
};

export default academicSearchAction;

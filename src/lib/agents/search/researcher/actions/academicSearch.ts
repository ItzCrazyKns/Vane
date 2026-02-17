import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk, SearchResultsResearchBlock } from '@/lib/types';
import { searchSearxng } from '@/lib/searxng';

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
    // Validate queries exists and is an array
    if (!input.queries || !Array.isArray(input.queries) || input.queries.length === 0) {
      return {
        type: 'search_results',
        results: [],
      };
    }
    
    input.queries = input.queries.slice(0, 3);

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        type: 'searching',
        id: crypto.randomUUID(),
        searching: input.queries,
      });

      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    const searchResultsBlockId = crypto.randomUUID();
    let searchResultsEmitted = false;

    let results: Chunk[] = [];

    const search = async (q: string) => {
      const res = await searchSearxng(q, {
        engines: ['arxiv', 'google scholar', 'pubmed'],
      });

      const resultChunks: Chunk[] = res.results.map((r) => ({
        content: r.content || r.title,
        metadata: {
          title: r.title,
          url: r.url,
        },
      }));

      results.push(...resultChunks);

      if (
        !searchResultsEmitted &&
        researchBlock &&
        researchBlock.type === 'research'
      ) {
        searchResultsEmitted = true;

        researchBlock.data.subSteps.push({
          id: searchResultsBlockId,
          type: 'search_results',
          reading: resultChunks,
        });

        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      } else if (
        searchResultsEmitted &&
        researchBlock &&
        researchBlock.type === 'research'
      ) {
        const subStepIndex = researchBlock.data.subSteps.findIndex(
          (step) => step.id === searchResultsBlockId,
        );

        const subStep = researchBlock.data.subSteps[
          subStepIndex
        ] as SearchResultsResearchBlock;

        subStep.reading.push(...resultChunks);

        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      }
    };

    await Promise.all(input.queries.map(search));

    return {
      type: 'search_results',
      results,
    };
  },
};

export default academicSearchAction;

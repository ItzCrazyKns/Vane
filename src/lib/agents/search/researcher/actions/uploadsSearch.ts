import z from 'zod';
import { ResearchAction } from '../../types';
import UploadStore from '@/lib/uploads/store';

const schema = z.object({
  queries: z
    .array(z.string())
    .describe(
      'A list of queries to search in user uploaded files. Can be a maximum of 3 queries.',
    ),
});

const uploadsSearchAction: ResearchAction<typeof schema> = {
  name: 'uploads_search',
  enabled: (config) =>
    (config.classification.classification.personalSearch &&
      config.fileIds.length > 0) ||
    config.fileIds.length > 0,
  schema,
  getToolDescription: () =>
    `Use this tool to perform searches over the user's uploaded files. This is useful when you need to gather information from the user's documents to answer their questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.`,
  getDescription: () => `
  Use this tool to perform searches over the user's uploaded files. This is useful when you need to gather information from the user's documents to answer their questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.
  Always ensure that the queries you use are directly relevant to the user's request and pertain to the content of their uploaded files.

  For example, if the user says "Please find information about X in my uploaded documents", you can call this tool with a query related to X to retrieve the relevant information from their files.
  Never use this tool to search the web or for information that is not contained within the user's uploaded files.
  `,
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
        id: crypto.randomUUID(),
        type: 'upload_searching',
        queries: input.queries,
      });

      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    const uploadStore = new UploadStore({
      embeddingModel: additionalConfig.embedding,
      fileIds: additionalConfig.fileIds,
    });

    const results = await uploadStore.query(input.queries, 10);

    const seenIds = new Map<string, number>();

    const filteredSearchResults = results
      .map((result, index) => {
        if (result.metadata.url && !seenIds.has(result.metadata.url)) {
          seenIds.set(result.metadata.url, index);
          return result;
        } else if (result.metadata.url && seenIds.has(result.metadata.url)) {
          const existingIndex = seenIds.get(result.metadata.url)!;
          const existingResult = results[existingIndex];

          existingResult.content += `\n\n${result.content}`;

          return undefined;
        }

        return result;
      })
      .filter((r) => r !== undefined);

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'upload_search_results',
        results: filteredSearchResults,
      });

      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    return {
      type: 'search_results',
      results: filteredSearchResults,
    };
  },
};

export default uploadsSearchAction;

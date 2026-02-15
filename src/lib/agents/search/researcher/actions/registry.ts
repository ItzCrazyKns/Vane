import { Tool, ToolCall } from '@/lib/models/types';
import {
  ActionOutput,
  AdditionalConfig,
  ClassifierOutput,
  ResearchAction,
  SearchAgentConfig,
  SearchSources,
} from '../../types';

class ActionRegistry {
  private static actions: Map<string, ResearchAction> = new Map();

  static register(action: ResearchAction<any>) {
    this.actions.set(action.name, action);
  }

  static get(name: string): ResearchAction | undefined {
    return this.actions.get(name);
  }

  static getAvailableActions(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }): ResearchAction[] {
    return Array.from(
      this.actions.values().filter((action) => action.enabled(config)),
    );
  }

  static getAvailableActionTools(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }): Tool[] {
    const availableActions = this.getAvailableActions(config);

    return availableActions.map((action) => ({
      name: action.name,
      description: action.getToolDescription({ mode: config.mode }),
      schema: action.schema,
    }));
  }

  static getAvailableActionsDescriptions(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }): string {
    const availableActions = this.getAvailableActions(config);

    return availableActions
      .map(
        (action) =>
          `<tool name="${action.name}">\n${action.getDescription({ mode: config.mode })}\n</tool>`,
      )
      .join('\n\n');
  }

  static async execute(
    actionName: string,
    params: any,
    additionalConfig: any,
  ): Promise<ActionOutput> {
    const action = this.get(actionName);

    if (!action) {
      console.error('❌ ActionRegistry: No action found for name:', actionName);
      return { type: 'search_results', results: [] };
    }

    // Validate and sanitize params using the action's Zod schema
    let validatedParams = params;
    try {
      if (action.schema) {
        const parseResult = action.schema.safeParse(params);
        if (!parseResult.success) {
          console.warn(
            '⚠️ ActionRegistry: Schema validation failed for action:',
            actionName,
          );
          console.warn('   Error:', parseResult.error.message);
          console.warn('   Received params:', JSON.stringify(params, null, 2));

          // Try to sanitize - ensure queries is always an array for search actions
          // Enhanced to handle stringified arrays like "['query1', 'query2']"
          const rawQueries = params?.queries;
          let sanitizedQueries: string[] = [];

          if (Array.isArray(rawQueries)) {
            sanitizedQueries = rawQueries;
          } else if (typeof rawQueries === 'string') {
            const queryString = rawQueries as string;
            const trimmedStr = queryString.trim();
            if (trimmedStr.startsWith('[') && trimmedStr.endsWith(']')) {
              try {
                const jsonStr = trimmedStr.replace(/'/g, '"');
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed)) {
                  console.log('📝 Registry: Parsed stringified array:', parsed);
                  sanitizedQueries = parsed;
                } else {
                  sanitizedQueries = [trimmedStr];
                }
              } catch (e) {
                sanitizedQueries = [trimmedStr];
              }
            } else {
              sanitizedQueries = [trimmedStr];
            }
          }

          validatedParams = {
            ...params,
            queries: sanitizedQueries,
          };

          // Re-validate with sanitized params
          const reparseResult = action.schema.safeParse(validatedParams);
          if (!reparseResult.success) {
            console.error(
              '❌ ActionRegistry: Sanitized params still failed validation',
            );
            return { type: 'search_results', results: [] };
          }
        } else {
          validatedParams = parseResult.data;
        }
      }
    } catch (validationError) {
      console.error(
        '❌ ActionRegistry: Error during schema validation:',
        validationError,
      );
      // Fallback sanitization with enhanced parsing
      const rawQueries = params?.queries;
      let fallbackQueries: string[] = [];

      if (Array.isArray(rawQueries)) {
        fallbackQueries = rawQueries;
      } else if (typeof rawQueries === 'string') {
        const queryString = rawQueries as string;
        const trimmedStr = queryString.trim();
        if (trimmedStr.startsWith('[') && trimmedStr.endsWith(']')) {
          try {
            const jsonStr = trimmedStr.replace(/'/g, '"');
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
              fallbackQueries = parsed;
            } else {
              fallbackQueries = [trimmedStr];
            }
          } catch (e) {
            fallbackQueries = [trimmedStr];
          }
        } else {
          fallbackQueries = [trimmedStr];
        }
      }

      validatedParams = {
        ...params,
        queries: fallbackQueries,
      };
    }

    try {
      const result = await action.execute(validatedParams, additionalConfig);
      return result;
    } catch (error: any) {
      console.error(
        `❌ ActionRegistry: Error executing action '${actionName}':`,
        error,
      );
      throw error; // Re-throw so executeAll can handle it properly
    }
  }

  static async executeAll(
    actions: ToolCall[],
    additionalConfig: AdditionalConfig & {
      researchBlockId: string;
      fileIds: string[];
    },
  ): Promise<ActionOutput[]> {
    console.log(
      '🔍 executeAll received finalToolCalls:',
      JSON.stringify(
        actions.map((a) => ({
          name: a.name,
          queriesType: typeof a.arguments?.queries,
          queriesIsArray: Array.isArray(a.arguments?.queries),
          queries: a.arguments?.queries,
        })),
        null,
        2,
      ),
    );
    const results: ActionOutput[] = [];

    // Process sequentially to avoid Promise.all() swallowing errors
    for (const actionConfig of actions.filter((a) => a?.name && a?.arguments)) {
      try {
        console.log(
          `🔄 ActionRegistry.executeAll: Executing action '${actionConfig.name}' with args:`,
          JSON.stringify(actionConfig.arguments, null, 2),
        );

        const output = await this.execute(
          actionConfig.name,
          actionConfig.arguments,
          additionalConfig,
        );
        results.push(output);
        console.log(
          `✅ ActionRegistry.executeAll: Action '${actionConfig.name}' completed successfully`,
        );
      } catch (error: any) {
        console.error(
          `❌ ActionRegistry.executeAll: Action '${actionConfig.name}' failed:`,
          error,
        );

        // Return safe fallback for any error
        if (
          error instanceof TypeError &&
          error.message.includes('map is not a function')
        ) {
          console.log('🛡️ Caught bad .map() call - returning empty results');
        }

        results.push({ type: 'search_results', results: [] });
      }
    }

    return results;
  }
}
export default ActionRegistry;

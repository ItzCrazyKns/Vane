import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import APISearchAgent from '@/lib/agents/search/api';

interface ChatRequestBody {
  optimizationMode: 'speed' | 'balanced' | 'quality';
  sources: SearchSources[];
  chatModel: ModelWithProvider;
  embeddingModel: ModelWithProvider;
  query: string;
  history: Array<[string, string]>;
  stream?: boolean;
  systemInstructions?: string;
  maxResultsPerQuery?: number; // Limits results per SearXNG query action; reduces LLM prompt size for local/small-context models
  maxTotalResults?: number;    // Limits total results across all engines post-merge; prevents context overflow when multiple engines are active
}

export const POST = async (req: Request) => {
  try {
    const body: ChatRequestBody = await req.json();

    if (!body.sources || !body.query) {
      return Response.json(
        { message: 'Missing sources or query' },
        { status: 400 },
      );
    }

    body.history = body.history || [];
    body.optimizationMode = body.optimizationMode || 'speed';
    body.stream = body.stream || false;

    const registry = new ModelRegistry();

    const [llm, embeddings] = await Promise.all([
      registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
      registry.loadEmbeddingModel(
        body.embeddingModel.providerId,
        body.embeddingModel.key,
      ),
    ]);

    const history: ChatTurnMessage[] = body.history.map((msg) => {
      return msg[0] === 'human'
        ? { role: 'user', content: msg[1] }
        : { role: 'assistant', content: msg[1] };
    });

    const session = SessionManager.createSession();

    const agent = new APISearchAgent();

    agent.searchAsync(session, {
      chatHistory: history,
      config: {
        embedding: embeddings,
        llm: llm,
        sources: body.sources,
        mode: body.optimizationMode,
        fileIds: [],
        systemInstructions: body.systemInstructions || '',
        maxResultsPerQuery: body.maxResultsPerQuery,
        maxTotalResults: body.maxTotalResults,
      },
      followUp: body.query,
      chatId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
    });

    if (!body.stream) {
      return new Promise(
        (
          resolve: (value: Response) => void,
          reject: (value: Response) => void,
        ) => {
          let message = '';
          let sources: any[] = [];

          session.subscribe((event: string, data: Record<string, any>) => {
            if (event === 'data') {
              try {
                if (data.type === 'response') {
                  message += data.data;
                } else if (data.type === 'searchResults') {
                  sources = data.data;
                }
              } catch (error) {
                reject(
                  Response.json(
                    { message: 'Error parsing data' },
                    { status: 500 },
                  ),
                );
              }
            }

            if (event === 'end') {
              resolve(Response.json({ message, sources }, { status: 200 }));
            }

            if (event === 'error') {
              reject(
                Response.json(
                  { message: 'Search error', error: data },
                  { status: 500 },
                ),
              );
            }
          });
        },
      );
    }

    const encoder = new TextEncoder();

    const abortController = new AbortController();
    const { signal } = abortController;

    const stream = new ReadableStream({
      start(controller) {
        let sources: any[] = [];

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'init',
              data: 'Stream connected',
            }) + '\n',
          ),
        );

        signal.addEventListener('abort', () => {
          session.removeAllListeners();

          try {
            controller.close();
          } catch (error) {}
        });

        session.subscribe((event: string, data: Record<string, any>) => {
          if (event === 'data') {
            if (signal.aborted) return;

            try {
              if (data.type === 'response') {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'response',
                      data: data.data,
                    }) + '\n',
                  ),
                );
              } else if (data.type === 'searchResults') {
                sources = data.data;
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'sources',
                      data: sources,
                    }) + '\n',
                  ),
                );
              }
            } catch (error) {
              controller.error(error);
            }
          }

          if (event === 'end') {
            if (signal.aborted) return;

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'done',
                }) + '\n',
              ),
            );
            controller.close();
          }

          if (event === 'error') {
            if (signal.aborted) return;

            controller.error(data);
          }
        });
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error(`Error in getting search results: ${err.message}`);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

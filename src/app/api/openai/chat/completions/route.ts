import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import ModelRegistry from '@/lib/models/registry';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage, TextBlock, Block, SourceBlock } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import UploadManager from '@/lib/uploads/manager';
import configManager from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const chatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  stream: z.boolean().optional().default(false),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
});

type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

const ensureChatExists = async (input: {
  id: string;
  sources: SearchSources[];
  query: string;
  fileIds: string[];
}) => {
  try {
    const exists = await db.query.chats
      .findFirst({
        where: eq(chats.id, input.id),
      })
      .execute();

    if (!exists) {
      await db.insert(chats).values({
        id: input.id,
        createdAt: new Date().toISOString(),
        sources: input.sources,
        title: input.query,
        files: input.fileIds.map((id) => {
          return {
            fileId: id,
            name: UploadManager.getFile(id)?.name || 'Uploaded File',
          };
        }),
      });
    }
  } catch (err) {
    console.error('Failed to check/save chat:', err);
  }
};

export const POST = async (req: NextRequest) => {
  const startTime = performance.now();
  try {
    const body = (await req.json()) as ChatCompletionRequest;
    console.log('[DEBUG] Chat Completion Request Body:', JSON.stringify(body, null, 2));

    const parseResult = chatCompletionRequestSchema.safeParse(body);
    if (!parseResult.success) {
      console.error('[DEBUG] Invalid request body:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error },
        { status: 400 }
      );
    }

    let { model, messages, stream } = parseResult.data;

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array cannot be empty' },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'Last message must be from user' },
        { status: 400 }
      );
    }

    const query = lastMessage.content;
    const history: ChatTurnMessage[] = messages
      .slice(0, -1)
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
    
    const systemMessage = messages.find(m => m.role === 'system')?.content || null;

    const registry = new ModelRegistry();
    const providers = await registry.getActiveProviders();
    let selectedProviderId: string | null = null;
    let selectedModelKey: string | null = null;
    let requestedSources: SearchSources[] = ['web'];

    // Handle source prefixes in model name (e.g., "academic/gpt-4")
    if (model.includes('/')) {
        const parts = model.split('/');
        if (['web', 'academic', 'discussions', 'news', 'videos', 'images'].includes(parts[0])) {
            requestedSources = [parts[0] as SearchSources];
            model = parts.slice(1).join('/');
            console.log(`[DEBUG] Extracted source: ${requestedSources[0]}, Remaining model: ${model}`);
        }
    }
    
    for (const provider of providers) {
      if (provider.chatModels.some((m) => m.key === model)) {
        selectedProviderId = provider.id;
        selectedModelKey = model;
        break;
      }
    }

    if (!selectedProviderId) {
        const parts = model.split('/');
        if (parts.length === 2) {
            const potentialProvider = providers.find(p => p.name.toLowerCase() === parts[0].toLowerCase() || p.id === parts[0]);
            if (potentialProvider) {
                 if (potentialProvider.chatModels.some(m => m.key === parts[1])) {
                     selectedProviderId = potentialProvider.id;
                     selectedModelKey = parts[1];
                 }
            }
        }
    }

    if (!selectedProviderId && (model.startsWith('gpt') || model.startsWith('claude') || model.startsWith('gemini') || model.includes('sonar'))) {
        for (const provider of providers) {
             if (model.startsWith('gpt') && provider.name.toLowerCase().includes('openai')) {
                 const match = provider.chatModels.find(m => m.key === model || m.key.includes(model));
                 if (match) {
                     selectedProviderId = provider.id;
                     selectedModelKey = match.key;
                     break;
                 }
             }
        }
    }

    if (!selectedProviderId || !selectedModelKey) {
        const firstChatModelProvider = providers.find(p => p.chatModels.length > 0);
        
        if (configManager.currentConfig.defaultChatModel) {
             selectedProviderId = configManager.currentConfig.defaultChatModel.providerId;
             selectedModelKey = configManager.currentConfig.defaultChatModel.key;
             console.log(`[DEBUG] Requested model '${model}' not found or not setup. Handling request using default model: ${selectedModelKey}`);
        } else if (firstChatModelProvider) {
            selectedProviderId = firstChatModelProvider.id;
            selectedModelKey = firstChatModelProvider.chatModels[0].key;
            console.log(`[DEBUG] Requested model '${model}' not found and no default model configured. Handling request using first available model: ${selectedModelKey} from provider ${firstChatModelProvider.name}`);
        } else {
            console.error(`[DEBUG] Model '${model}' not found and no active providers with chat models are configured.`);
            return NextResponse.json(
                { error: `Model '${model}' not found and no active providers with chat models are configured.` },
                { status: 404 }
            );
        }
    }

    console.log(`[DEBUG] Selected Provider: ${selectedProviderId}, Model: ${selectedModelKey}, Sources: ${requestedSources}`);

    const [llm, embedding] = await Promise.all([
        registry.loadChatModel(selectedProviderId!, selectedModelKey!),
        (async () => {
            let embeddingModelProviderId = selectedProviderId;
            let emKey = providers.find(p => p.id === selectedProviderId)?.embeddingModels[0]?.key;

            if (configManager.currentConfig.defaultEmbeddingModel) {
                embeddingModelProviderId = configManager.currentConfig.defaultEmbeddingModel.providerId;
                emKey = configManager.currentConfig.defaultEmbeddingModel.key;
            }

            if (!emKey) {
                for (const p of providers) {
                    if (p.embeddingModels.length > 0) {
                        embeddingModelProviderId = p.id;
                        emKey = p.embeddingModels[0].key;
                        break;
                    }
                }
            }

            if (!emKey) {
                 throw new Error('No embedding model available.');
            }
            return registry.loadEmbeddingModel(embeddingModelProviderId!, emKey!);
        })()
    ]);

    const chatId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    const agent = new SearchAgent();
    const session = SessionManager.createSession();

    await ensureChatExists({
        id: chatId,
        sources: requestedSources,
        fileIds: [],
        query: query,
    });

    console.log(`[DEBUG] setup complete in ${(performance.now() - startTime).toFixed(2)}ms. Starting search...`);

    if (stream) {
      console.log('[DEBUG] Streaming response...');
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();
      const blockLengths = new Map<string, number>();
      let citations: string[] = [];

      const disconnect = session.subscribe((event: string, data: any) => {
        try {
            if (event === 'data') {
                if (data.type === 'block') {
                    const block = data.block as Block;
                    if (block.type === 'text') {
                        const content = block.data;
                        blockLengths.set(block.id, content.length);
                        
                        const chunk = {
                            id: messageId,
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: model,
                            choices: [
                                {
                                    index: 0,
                                    delta: { content: content },
                                    finish_reason: null,
                                }
                            ]
                        };
                        writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    } else if (block.type === 'source') {
                        const sourceBlock = block as SourceBlock;
                        citations = Array.from(new Set([...citations, ...sourceBlock.data.map(s => s.metadata.url)]));
                    }
                } else if (data.type === 'updateBlock') {
                    const block = session.getBlock(data.blockId);
                    if (block && block.type === 'text') {
                        const fullContent = block.data;
                        const lastLen = blockLengths.get(block.id) || 0;
                        const delta = fullContent.slice(lastLen);
                        
                        if (delta.length > 0) {
                            blockLengths.set(block.id, fullContent.length);
                            const chunk = {
                                id: messageId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: model,
                                choices: [
                                    {
                                        index: 0,
                                        delta: { content: delta },
                                        finish_reason: null,
                                    }
                                ]
                            };
                            writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                        }
                    }
                }
            } else if (event === 'end') {
                console.log(`[DEBUG] search complete in ${(performance.now() - startTime).toFixed(2)}ms`);
                const chunk = {
                    id: messageId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [
                        {
                            index: 0,
                            delta: {},
                            finish_reason: 'stop',
                        }
                    ],
                    citations: citations 
                };
                writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                writer.write(encoder.encode('data: [DONE]\n\n'));
                writer.close();
                session.removeAllListeners();
            } else if (event === 'error') {
                console.error('[DEBUG] Session error:', data);
                const chunk = {
                    id: messageId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [
                        {
                            index: 0,
                            delta: { content: `\n[Error: ${JSON.stringify(data.data || 'Unknown error')}]` },
                            finish_reason: 'stop',
                        }
                    ]
                };
                writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                writer.write(encoder.encode('data: [DONE]\n\n'));
                writer.close();
                session.removeAllListeners();
            }
        } catch (err) {
            console.error('[DEBUG] Stream processing error:', err);
            writer.close();
            session.removeAllListeners();
        }
      });

      agent.searchAsync(session, {
        chatHistory: history,
        followUp: query,
        chatId: chatId,
        messageId: messageId,
        config: {
          llm,
          embedding: embedding,
          sources: requestedSources, 
          mode: 'speed', 
          fileIds: [],
          systemInstructions: systemMessage || 'None',
        },
      });

      req.signal.addEventListener('abort', () => {
        console.log('[DEBUG] Request aborted');
        disconnect();
        writer.close();
      });

      return new Response(responseStream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
        // Non-streaming response
        return new Promise<Response>((resolve) => {
            let citations: string[] = [];
            
            const disconnect = session.subscribe((event: string, data: any) => {
                if (event === 'data') {
                    if (data.type === 'block') {
                        const block = data.block as Block;
                        if (block.type === 'source') {
                            const sourceBlock = block as SourceBlock;
                            citations = Array.from(new Set([...citations, ...sourceBlock.data.map(s => s.metadata.url)]));
                        }
                    }
                } else if (event === 'end') {
                    console.log(`[DEBUG] search complete in ${(performance.now() - startTime).toFixed(2)}ms`);
                    const blocks = session.getAllBlocks();
                    const textBlocks = blocks.filter(b => b.type === 'text') as TextBlock[];
                    const fullContent = textBlocks.map(b => b.data).join('');
                    
                    const responseBody = {
                        id: messageId,
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: model,
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: fullContent,
                                },
                                finish_reason: 'stop',
                            }
                        ],
                        usage: {
                            prompt_tokens: 0, 
                            completion_tokens: 0, 
                            total_tokens: 0
                        },
                        citations: citations 
                    };
                    console.log('[DEBUG] Sending non-streaming response with citations:', citations.length);
                    console.log('[DEBUG] Response Content preview:', fullContent.substring(0, 500) + '...');
                    resolve(NextResponse.json(responseBody));
                    session.removeAllListeners();
                } else if (event === 'error') {
                     console.error('[DEBUG] Session error (non-streaming):', data);
                     resolve(NextResponse.json(
                        { error: 'An error occurred during processing', details: data },
                        { status: 500 }
                    ));
                    session.removeAllListeners();
                }
            });

            agent.searchAsync(session, {
                chatHistory: history,
                followUp: query,
                chatId: chatId,
                messageId: messageId,
                config: {
                  llm,
                  embedding: embedding,
                  sources: requestedSources, 
                  mode: 'speed', 
                  fileIds: [],
                  systemInstructions: systemMessage || 'None',
                },
            });
        });
    }

  } catch (err: any) {
    console.error('[DEBUG] Chat API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
};

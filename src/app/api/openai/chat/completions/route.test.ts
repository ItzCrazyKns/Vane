import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoist mocks
const mocks = vi.hoisted(() => {
    return {
        session: {
            id: 'test-session-id',
            subscribe: vi.fn(),
            emit: vi.fn(),
            emitBlock: vi.fn(),
            getBlock: vi.fn(),
            getAllBlocks: vi.fn(),
            removeAllListeners: vi.fn(),
        },
        registry: {
            getActiveProviders: vi.fn(),
            loadChatModel: vi.fn(),
            loadEmbeddingModel: vi.fn(),
        },
        agent: {
            searchAsync: vi.fn(),
        },
        config: {
            currentConfig: {
                defaultChatModel: undefined as any,
                defaultEmbeddingModel: undefined as any,
            }
        }
    };
});

vi.mock('@/lib/models/registry', () => {
    return {
        default: class {
            getActiveProviders = mocks.registry.getActiveProviders;
            loadChatModel = mocks.registry.loadChatModel;
            loadEmbeddingModel = mocks.registry.loadEmbeddingModel;
        }
    };
});

vi.mock('@/lib/agents/search', () => {
    return {
        default: class {
            searchAsync = mocks.agent.searchAsync;
        }
    };
});

vi.mock('@/lib/session', () => {
    return {
        default: {
            createSession: vi.fn().mockReturnValue(mocks.session),
            getSession: vi.fn(),
            getAllSessions: vi.fn(),
        }
    };
});

vi.mock('@/lib/db', () => ({
    default: {
        query: {
            chats: {
                findFirst: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(true) }),
            },
        },
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(true) }) }),
    },
}));

vi.mock('@/lib/db/schema', () => ({
    chats: { id: 'chats' },
    messages: { id: 'messages' },
}));

vi.mock('@/lib/uploads/manager', () => ({
    default: { getFile: vi.fn() },
}));

vi.mock('@/lib/config', () => ({
    default: mocks.config
}));

// Import POST after mocks are set up
import { POST } from './route';

describe('OpenAI Chat Completions API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Reset config
        mocks.config.currentConfig.defaultChatModel = undefined;

        mocks.registry.getActiveProviders.mockResolvedValue([
            {
                id: 'openai-provider',
                name: 'OpenAI',
                chatModels: [{ key: 'gpt-4', name: 'GPT-4' }],
                embeddingModels: [{ key: 'text-embedding-3-small', name: 'Embedding' }],
            }
        ]);
        mocks.registry.loadChatModel.mockResolvedValue({ streamText: vi.fn() });
        mocks.registry.loadEmbeddingModel.mockResolvedValue({});
    });

    it('should return 400 for invalid request body', async () => {
        const req = new NextRequest('http://localhost/api/openai/chat/completions', {
            method: 'POST',
            body: JSON.stringify({ invalid: 'field' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should return 404 if model is not found', async () => {
        mocks.registry.getActiveProviders.mockResolvedValue([]);

        const req = new NextRequest('http://localhost/api/openai/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: 'non-existent',
                messages: [{ role: 'user', content: 'hello' }],
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(404);
    });

    it('should handle non-streaming request correctly', async () => {
        mocks.session.subscribe.mockImplementation((cb: any) => {
            setTimeout(() => {
                mocks.session.getAllBlocks.mockReturnValue([
                    { type: 'text', data: 'Hello from Perplexica!' }
                ]);
                cb('end', {});
            }, 10);
            return () => {};
        });

        const req = new NextRequest('http://localhost/api/openai/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [{ role: 'user', content: 'hello' }],
                stream: false,
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.choices[0].message.content).toBe('Hello from Perplexica!');
    });

    it('should handle streaming request correctly', async () => {
        let eventHandler: any;
        mocks.session.subscribe.mockImplementation((cb: any) => {
            eventHandler = cb;
            return () => {};
        });

        const req = new NextRequest('http://localhost/api/openai/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [{ role: 'user', content: 'hello' }],
                stream: true,
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const reader = res.body?.getReader();
        
        setTimeout(() => {
            eventHandler('data', { type: 'block', block: { type: 'text', id: 'b1', data: 'Part 1' } });
            mocks.session.getBlock.mockReturnValue({ type: 'text', id: 'b1', data: 'Part 1 and 2' });
            eventHandler('data', { type: 'updateBlock', blockId: 'b1' });
            eventHandler('end', {});
        }, 10);

        const results: string[] = [];
        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            results.push(new TextDecoder().decode(value));
        }

        expect(results.some(r => r.includes('Part 1'))).toBe(true);
        expect(results.some(r => r.includes('and 2'))).toBe(true);
    });
});

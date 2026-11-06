import { afterEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import OpenAILLM from '@/lib/models/providers/openai/openaiLLM';
import OllamaLLM from '@/lib/models/providers/ollama/ollamaLLM';
import { isOpenAIReasoningModel } from '@/lib/models/utils/objectDefaults';

const schema = z.object({ ok: z.boolean() });
const messages = [{ role: 'user' as const, content: 'hi' }];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/* Captures the JSON body the client sends; answers with {"ok": true}. */
const captureOpenAI = (stream = false) => {
  const bodies: any[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: any, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (stream) {
        const chunk = {
          id: 'x',
          object: 'chat.completion.chunk',
          created: 0,
          model: 'm',
          choices: [
            { index: 0, delta: { content: 'a' }, finish_reason: 'stop' },
          ],
        };
        return new Response(
          `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`,
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }
      return Response.json({
        id: 'x',
        object: 'chat.completion',
        created: 0,
        model: 'm',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: '{"ok": true}' },
          },
        ],
      });
    }),
  );
  return bodies;
};

const captureOllama = () => {
  const bodies: any[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: any, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({
        model: 'm',
        created_at: '',
        message: { role: 'assistant', content: '{"ok": true}' },
        done: true,
      });
    }),
  );
  return bodies;
};

const openai = (model = 'qwen/qwen3.6-27b') =>
  new OpenAILLM({ apiKey: 'k', model, baseURL: 'http://lmstudio/v1' });

describe('generateObject sampling defaults (OpenAI-compatible)', () => {
  it('sends temperature 0.2 and a max_tokens cap when the caller sets none', async () => {
    const bodies = captureOpenAI();
    await openai().generateObject({ schema, messages });

    expect(bodies[0].temperature).toBe(0.2);
    expect(bodies[0].max_tokens).toBe(8192);
    expect(bodies[0].max_completion_tokens).toBeUndefined();
    expect(bodies[0].response_format.type).toBe('json_schema');
  });

  it('lets the caller override both', async () => {
    const bodies = captureOpenAI();
    await openai().generateObject({
      schema,
      messages,
      options: { temperature: 0.9, maxTokens: 100 },
    });

    expect(bodies[0].temperature).toBe(0.9);
    expect(bodies[0].max_completion_tokens).toBe(100);
    expect(bodies[0].max_tokens).toBeUndefined();
  });

  it('reads LLM_OBJECT_TEMPERATURE / LLM_OBJECT_MAX_TOKENS (0 = no cap)', async () => {
    vi.stubEnv('LLM_OBJECT_TEMPERATURE', '0');
    vi.stubEnv('LLM_OBJECT_MAX_TOKENS', '0');
    const bodies = captureOpenAI();
    await openai().generateObject({ schema, messages });

    expect(bodies[0].temperature).toBe(0);
    expect(bodies[0].max_tokens).toBeUndefined();
  });

  it('keeps temperature 1 and no cap for OpenAI reasoning models', async () => {
    const bodies = captureOpenAI();
    await openai('gpt-5-mini').generateObject({ schema, messages });

    expect(bodies[0].temperature).toBe(1);
    expect(bodies[0].max_tokens).toBeUndefined();
    expect(bodies[0].max_completion_tokens).toBeUndefined();
  });

  it('leaves streamed text on the old default', async () => {
    const bodies = captureOpenAI(true);
    for await (const _ of openai().streamText({ messages })) {
      /* drain */
    }

    expect(bodies[0].temperature).toBe(1);
    expect(bodies[0].max_tokens).toBeUndefined();
  });
});

describe('generateObject sampling defaults (Ollama)', () => {
  const ollama = () => new OllamaLLM({ baseURL: 'http://ollama', model: 'm' });

  it('sends temperature 0.2 and num_predict 8192', async () => {
    const bodies = captureOllama();
    await ollama().generateObject({ schema, messages });

    expect(bodies[0].options.temperature).toBe(0.2);
    expect(bodies[0].options.num_predict).toBe(8192);
  });

  it('lets the caller override both, and generateText keeps 0.7', async () => {
    const bodies = captureOllama();
    await ollama().generateObject({
      schema,
      messages,
      options: { temperature: 0.5, maxTokens: 10 },
    });
    await ollama().generateText({ messages });

    expect(bodies[0].options.temperature).toBe(0.5);
    expect(bodies[0].options.num_predict).toBe(10);
    expect(bodies[1].options.temperature).toBe(0.7);
    expect(bodies[1].options.num_predict).toBeUndefined();
  });
});

describe('isOpenAIReasoningModel', () => {
  it.each([
    ['o1', true],
    ['o3-mini', true],
    ['o4-mini', true],
    ['gpt-5', true],
    ['gpt-5.2-pro', true],
    ['openai/gpt-5-mini', true],
    ['gpt-4o', false],
    ['gpt-4.1-mini', false],
    ['qwen/qwen3.6-27b', false],
    ['anthropic/claude-sonnet-4-5', false],
    ['olmo-2', false],
  ])('%s -> %s', (model, expected) => {
    expect(isOpenAIReasoningModel(model)).toBe(expected);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import OpenAILLM from '@/lib/models/providers/openai/openaiLLM';
import OllamaLLM from '@/lib/models/providers/ollama/ollamaLLM';
import { parseModelJson, stripCodeFences } from '@/lib/models/utils/json';

const schema = z.object({
  skip: z.boolean(),
  query: z.string(),
});

const messages = [{ role: 'user' as const, content: 'hi' }];

/* What Claude via LiteLLM / OpenRouter sends back (upstream issue #959). */
const fenced = [
  '```json\n{"skip": false, "query": "vane"}\n```',
  '```\n{"skip": false, "query": "vane"}\n```',
  'Here is the JSON:\n\n```json\n{"skip": false, "query": "vane"}\n```\n',
];

const openAIReply = (content: string) =>
  Response.json({
    id: 'x',
    object: 'chat.completion',
    created: 0,
    model: 'm',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content, refusal: null },
      },
    ],
  });

afterEach(() => vi.unstubAllGlobals());

describe('generateObject accepts JSON wrapped in markdown fences', () => {
  it.each(fenced)('OpenAI-compatible: %j', async (content) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => openAIReply(content)),
    );
    const llm = new OpenAILLM({
      apiKey: 'k',
      model: 'anthropic/claude',
      baseURL: 'http://litellm/v1',
    });

    await expect(llm.generateObject({ schema, messages })).resolves.toEqual({
      skip: false,
      query: 'vane',
    });
  });

  it.each(fenced)('Ollama: %j', async (content) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          model: 'm',
          created_at: '',
          message: { role: 'assistant', content },
          done: true,
        }),
      ),
    );
    const llm = new OllamaLLM({ baseURL: 'http://ollama', model: 'm' });

    await expect(llm.generateObject({ schema, messages })).resolves.toEqual({
      skip: false,
      query: 'vane',
    });
  });

  it('still parses plain JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => openAIReply('{"skip": true, "query": ""}')),
    );
    const llm = new OpenAILLM({ apiKey: 'k', model: 'm' });

    await expect(llm.generateObject({ schema, messages })).resolves.toEqual({
      skip: true,
      query: '',
    });
  });
});

describe('stripCodeFences', () => {
  it('leaves bare JSON alone, even with ``` inside a string', () => {
    const raw = '{"a": "x ```json y``` z"}';
    expect(stripCodeFences(raw)).toBe(raw);
    expect(parseModelJson(raw)).toEqual({ a: 'x ```json y``` z' });
  });

  it('unwraps fenced arrays and CRLF fences', () => {
    expect(parseModelJson('```json\r\n[1, 2]\r\n```')).toEqual([1, 2]);
  });
});

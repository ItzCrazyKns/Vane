import { afterEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import OpenAILLM from '@/lib/models/providers/openai/openaiLLM';
import OllamaLLM from '@/lib/models/providers/ollama/ollamaLLM';
import { InstrumentedLLM, newRecorder } from '../instrument';
import { analyze } from '../analyze';
import { buildReport, reportToMarkdown } from '../report';
import type { CaseResult } from '../runner';
import { runTraced, withTraceLabel } from '@/lib/trace';

const schema = z.object({ q: z.string() });
const messages = [{ role: 'user' as const, content: 'oi' }];

const completion = (content: string, extra: object = {}) =>
  Response.json({
    id: 'x',
    object: 'chat.completion',
    created: 0,
    model: 'm',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content, refusal: null, ...extra },
      },
    ],
    usage: {
      prompt_tokens: 250,
      completion_tokens: 900,
      total_tokens: 1150,
      completion_tokens_details: { reasoning_tokens: 880 },
    },
  });

const sse = (chunks: object[]) =>
  new Response(
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') +
      'data: [DONE]\n\n',
    { headers: { 'content-type': 'text/event-stream' } },
  );
const delta = (d: object, finish: string | null = null) => ({
  id: 'x',
  object: 'chat.completion.chunk',
  created: 0,
  model: 'm',
  choices: [{ index: 0, delta: d, finish_reason: finish }],
});

const openai = () =>
  new OpenAILLM({ apiKey: 'k', model: 'qwen3', baseURL: 'http://lms/v1' });

afterEach(() => vi.unstubAllGlobals());

const traced = <T>(fn: () => Promise<T>) => runTraced(() => {}, fn);

describe('contagem de tokens pelo servidor', () => {
  it('generateObject (OpenAI-compatível) grava usage e raciocínio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        completion('{"q":"a"}', { reasoning_content: 'pensando'.repeat(10) }),
      ),
    );
    const rec = newRecorder();
    const llm = new InstrumentedLLM(openai(), rec);
    await traced(() =>
      withTraceLabel('classifier', () =>
        llm.generateObject({ schema, messages }),
      ),
    );
    expect(rec.llm[0].usage).toEqual({
      promptTokens: 250,
      completionTokens: 900,
      reasoningTokens: 880,
      reasoningChars: 80,
    });
  });

  it('streamText pede usage só dentro do benchmark e soma o raciocínio', async () => {
    const bodies: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: any, init: any) => {
        bodies.push(JSON.parse(init.body));
        return sse([
          delta({ reasoning_content: 'hmm ' }),
          delta({ content: 'Olá' }),
          delta({ content: '!' }, 'stop'),
          {
            id: 'x',
            object: 'chat.completion.chunk',
            created: 0,
            model: 'm',
            choices: [],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          },
        ]);
      }),
    );

    let text = '';
    for await (const c of openai().streamText({ messages }))
      text += c.contentChunk;
    expect(text).toBe('Olá!');
    expect(bodies[0].stream_options).toBeUndefined();

    const rec = newRecorder();
    const llm = new InstrumentedLLM(openai(), rec);
    await traced(async () => {
      for await (const _ of llm.streamText({ messages })) void _;
    });
    expect(bodies[1].stream_options).toEqual({ include_usage: true });
    expect(rec.llm[0].usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      reasoningChars: 4,
    });
  });

  it('chamadas em paralelo não misturam a contagem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: any, init: any) => {
        const body = JSON.parse(init.body);
        await new Promise((r) =>
          setTimeout(r, body.messages[0].content === 'a' ? 30 : 0),
        );
        return Response.json({
          id: 'x',
          object: 'chat.completion',
          created: 0,
          model: 'm',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: '{"q":"x"}',
                refusal: null,
              },
            },
          ],
          usage: {
            prompt_tokens: body.messages[0].content === 'a' ? 1 : 2,
            completion_tokens: 1,
            total_tokens: 2,
          },
        });
      }),
    );
    const rec = newRecorder();
    const llm = new InstrumentedLLM(openai(), rec);
    await traced(() =>
      Promise.all([
        withTraceLabel('a', () =>
          llm.generateObject({
            schema,
            messages: [{ role: 'user', content: 'a' }],
          }),
        ),
        withTraceLabel('b', () =>
          llm.generateObject({
            schema,
            messages: [{ role: 'user', content: 'b' }],
          }),
        ),
      ]),
    );
    const byLabel = Object.fromEntries(
      rec.llm.map((c) => [c.label, c.usage?.promptTokens]),
    );
    expect(byLabel).toEqual({ a: 1, b: 2 });
  });

  it('Ollama: tokens e tempos do servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          model: 'm',
          created_at: 'now',
          message: { role: 'assistant', content: '{"q":"a"}', thinking: 'abc' },
          done: true,
          prompt_eval_count: 120,
          eval_count: 40,
          eval_duration: 2_000_000_000,
          prompt_eval_duration: 500_000_000,
        }),
      ),
    );
    const rec = newRecorder();
    const llm = new InstrumentedLLM(
      new OllamaLLM({ model: 'qwen3', baseURL: 'http://ollama:11434' } as any),
      rec,
    );
    await traced(() => llm.generateObject({ schema, messages }));
    expect(rec.llm[0].usage).toEqual({
      promptTokens: 120,
      completionTokens: 40,
      generationMs: 2000,
      promptMs: 500,
      reasoningChars: 3,
    });
  });
});

const result = (over: Partial<CaseResult>): CaseResult => ({
  id: 'web-speed',
  label: 'Web · speed',
  kind: 'search',
  mode: 'speed',
  query: 'Qual é a capital da Austrália?',
  expectSkipSearch: false,
  ok: true,
  timing: { totalMs: 10000, researchDoneMs: 4000, firstTokenMs: 5000 },
  answer: 'A capital é Camberra[1].',
  sources: [
    { title: 'Canberra', url: 'https://pt.wikipedia.org/wiki/Canberra' },
  ],
  resultCount: 1,
  llm: [],
  embedding: [],
  http: [],
  events: [],
  ...over,
});

describe('análise com tokens', () => {
  const r = result({
    llm: [
      {
        kind: 'generateObject',
        label: 'classifier',
        startMs: 0,
        ms: 20000,
        inputChars: 6000,
        outputChars: 260,
        usage: {
          promptTokens: 1700,
          completionTokens: 900,
          reasoningTokens: 850,
        },
      },
      {
        kind: 'streamText',
        label: 'writer',
        startMs: 20000,
        ms: 21000,
        firstChunkMs: 1000,
        inputChars: 5000,
        outputChars: 800,
        usage: { promptTokens: 1400, completionTokens: 120 },
      },
    ],
  });

  it('acusa raciocínio medido e usa tokens/s reais do redator', () => {
    const a = analyze([r]);
    const t = a.findings.map((f) => f.title);
    expect(t).toContain('O modelo gera raciocínio que o app descarta');
    expect(t).not.toContain(
      'O modelo raciocina escondido nas chamadas estruturadas',
    );
    expect(a.rows[0].writerTokensPerSec).toBe(6);
    expect(t).toContain('Geração da resposta lenta');
    expect(
      a.findings.find((f) => f.title === 'Geração da resposta lenta')!.detail,
    ).toMatch(/6 tokens\/s/);
    expect(a.rows[0].tokens).toEqual({
      prompt: 3100,
      completion: 1020,
      reasoning: 850,
      reasoningChars: 0,
    });
  });

  it('relatório mostra a tabela de tokens', () => {
    const md = reportToMarkdown(
      buildReport(
        {
          appVersion: 't',
          node: 'v',
          startedAt: 'now',
          chatModel: { provider: 'p', key: 'k' },
          embeddingModel: { provider: 'p', key: 'e' },
          searchProvider: 'searxng',
          searxngConfigured: true,
          firecrawlConfigured: false,
          bifrostEnabled: false,
        },
        [r],
      ),
    );
    expect(md).toContain('## Tokens (contagem do servidor)');
    expect(md).toContain('| Web · speed | 3.100 | 1.020 | 850 |');
  });
});

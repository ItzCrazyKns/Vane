import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  pageKey,
  patchScraper,
  SearxngReplayServer,
  searxngKey,
} from '../lib/replay';
import {
  citedNumbers,
  guessLanguage,
  runChecks,
  EvalRecord,
} from '../lib/checks';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eval-test-'));

describe('replay da SearxNG', () => {
  let server: SearxngReplayServer | undefined;
  afterEach(async () => server?.stop());

  it('a chave ignora format e a ordem dos parâmetros', () => {
    const a = new URLSearchParams('format=json&q=rust&engines=bing,google');
    const b = new URLSearchParams('engines=bing,google&q=rust');
    expect(searxngKey(a)).toBe(searxngKey(b));
    expect(searxngKey(a)).not.toBe(searxngKey(new URLSearchParams('q=go')));
  });

  it('devolve a resposta gravada e registra a falta com lista vazia', async () => {
    const dir = tmp();
    const params = new URLSearchParams('q=rust');
    fs.writeFileSync(
      path.join(dir, `${searxngKey(params)}.json`),
      JSON.stringify({
        request: {},
        response: {
          results: [{ title: 't', url: 'u', content: 'c' }],
          suggestions: [],
        },
      }),
    );
    server = new SearxngReplayServer({ mode: 'replay', fixturesDir: dir });
    const base = await server.start();

    const hit = await (await fetch(`${base}/search?format=json&q=rust`)).json();
    expect(hit.results).toHaveLength(1);

    const miss = await (await fetch(`${base}/search?format=json&q=go`)).json();
    expect(miss).toEqual({ results: [], suggestions: [] });
    expect(server.misses).toEqual(['format=json&q=go']);
  });
});

describe('replay do scraper', () => {
  it('serve a página gravada e devolve o formato de falha quando falta', async () => {
    const dir = tmp();
    fs.writeFileSync(
      path.join(dir, `${pageKey('https://a.test/')}.json`),
      JSON.stringify({ url: 'https://a.test/', title: 'A', content: 'texto' }),
    );
    let realCalls = 0;
    const scraper = {
      scrape: async (_url: string) => {
        realCalls++;
        return { title: 'real', content: 'real' };
      },
    };
    const patched = patchScraper(scraper, { mode: 'replay', fixturesDir: dir });

    expect(await scraper.scrape('https://a.test/')).toEqual({
      title: 'A',
      content: 'texto',
    });
    expect(await scraper.scrape('https://b.test/')).toEqual({
      title: 'Failed to scrape',
      content: '# https://b.test/\n\nError scraping content.',
    });
    expect(patched.misses).toEqual(['https://b.test/']);
    expect(realCalls).toBe(0);
  });

  it('no modo record chama o scraper real e grava', async () => {
    const dir = tmp();
    const scraper = {
      scrape: async (_url: string) => ({ title: 'T', content: 'C' }),
    };
    patchScraper(scraper, { mode: 'record', fixturesDir: dir });
    await scraper.scrape('https://c.test/');
    const saved = JSON.parse(
      fs.readFileSync(
        path.join(dir, `${pageKey('https://c.test/')}.json`),
        'utf-8',
      ),
    );
    expect(saved).toEqual({ url: 'https://c.test/', title: 'T', content: 'C' });
  });
});

describe('verificações automáticas', () => {
  const rec = (over: Partial<EvalRecord>): EvalRecord => ({
    id: 'X01',
    group: 'g',
    mode: 'speed',
    query: 'Qual é a capital da Austrália?',
    expectSkipSearch: false,
    answer: 'A capital é Camberra[1].',
    sources: [{ content: 'Canberra' }],
    ...over,
  });
  const failed = (r: EvalRecord, ref?: EvalRecord) =>
    runChecks(r, ref)
      .filter((c) => !c.pass)
      .map((c) => c.name);

  it('lê as formas de citação que a interface transforma em link', () => {
    expect(citedNumbers('a[1] b[2][3] c[4, 5] d[x]')).toEqual([1, 2, 3, 4, 5]);
  });

  it('detecta o idioma das perguntas da avaliação', () => {
    const q = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'questions.json'), 'utf-8'),
    ).questions;
    const langs = Object.fromEntries(
      q.map((x: any) => [x.id, guessLanguage(x.query)]),
    );
    expect(langs.A01).toBe('pt');
    expect(langs.A04).toBe('en');
    expect(langs.D23).toBe('en');
    expect(langs.F29).toBe('pt');
    expect(Object.values(langs)).not.toContain('unknown');
  });

  it('aprova uma resposta correta', () => {
    expect(failed(rec({}))).toEqual([]);
  });

  it('reprova citação fora da lista, título principal e idioma errado', () => {
    expect(
      failed(
        rec({ answer: '# Título\n\nThe capital is Canberra and it is[2].' }),
      ),
    ).toEqual(['citacoes-validas', 'mesmo-idioma', 'sem-titulo-principal']);
  });

  it('reprova citação quando a busca foi pulada', () => {
    expect(
      failed(
        rec({
          expectSkipSearch: true,
          sources: [],
          answer: 'É 212 °F para a água[1].',
        }),
      ),
    ).toEqual(['citacoes-validas', 'sem-citacao-sem-busca']);
  });

  it('ignora o bloco <think> e títulos dentro de código', () => {
    expect(
      failed(
        rec({
          answer:
            '<think># plano</think>A capital é Camberra[1].\n```\n# comentário\n```',
        }),
      ),
    ).toEqual([]);
  });

  it('no quality, compara o tamanho com a referência (±30%)', () => {
    const ref = rec({ mode: 'quality', answer: 'a'.repeat(100) + ' é' });
    expect(
      failed(rec({ mode: 'quality', answer: 'a'.repeat(60) + ' é' }), ref),
    ).toEqual(['tamanho-quality-30pct']);
    expect(
      failed(rec({ mode: 'quality', answer: 'a'.repeat(90) + ' é' }), ref),
    ).toEqual([]);
  });
});

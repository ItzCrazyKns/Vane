import type { SearchSources } from '@/lib/agents/search/types';

/* Fixed questions for the settings benchmark. They are not user data and
   are the only text the benchmark sends to the models. */
export type BenchmarkCase = {
  id: string;
  kind: 'search' | 'images' | 'videos';
  label: string;
  query: string;
  mode?: 'speed' | 'balanced' | 'quality';
  sources?: SearchSources[];
  history?: [string, string][];
  /** The classifier should skip search (answer from a widget or the model). */
  expectSkipSearch?: boolean;
  /** Slow case: off by default in the UI. */
  slow?: boolean;
};

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'web-speed',
    kind: 'search',
    label: 'Web · speed',
    query: 'Qual é a capital da Austrália e quando ela foi fundada?',
    mode: 'speed',
    sources: ['web'],
  },
  {
    id: 'web-balanced',
    kind: 'search',
    label: 'Web · balanced',
    query:
      'Compare Rust e Go para serviços web: desempenho, ecossistema e curva de aprendizado.',
    mode: 'balanced',
    sources: ['web'],
  },
  {
    id: 'web-quality',
    kind: 'search',
    label: 'Web · quality',
    query:
      'Como funciona o Pix e que impacto ele teve sobre os bancos brasileiros?',
    mode: 'quality',
    sources: ['web'],
    slow: true,
  },
  {
    id: 'academic',
    kind: 'search',
    label: 'Acadêmica · balanced',
    query:
      'What does the research say about spaced repetition and long-term retention?',
    mode: 'balanced',
    sources: ['academic'],
  },
  {
    id: 'discussions',
    kind: 'search',
    label: 'Discussões · speed',
    query: 'O que as pessoas acham de teclados mecânicos para programar?',
    mode: 'speed',
    sources: ['discussions'],
  },
  {
    id: 'site-filter',
    kind: 'search',
    label: 'Restrita a domínio · speed',
    query: 'site:wikipedia.org história do Santos Dumont e do 14-bis',
    mode: 'speed',
    sources: ['web'],
  },
  {
    id: 'follow-up',
    kind: 'search',
    label: 'Pergunta de continuação · speed',
    query: 'E quantos anos ele tem?',
    mode: 'speed',
    sources: ['web'],
    history: [
      ['human', 'Quem é o atual presidente da França?'],
      ['assistant', 'O atual presidente da França é Emmanuel Macron.'],
    ],
  },
  {
    id: 'calculation',
    kind: 'search',
    label: 'Cálculo (sem busca)',
    query: 'Quanto é 15% de 2.340?',
    mode: 'speed',
    sources: ['web'],
    expectSkipSearch: true,
  },
  {
    id: 'weather',
    kind: 'search',
    label: 'Widget de clima',
    query: 'Como está o tempo em São Paulo agora?',
    mode: 'speed',
    sources: ['web'],
  },
  {
    id: 'images',
    kind: 'images',
    label: 'Busca de imagens',
    query: 'Ponte Golden Gate ao pôr do sol',
  },
  {
    id: 'videos',
    kind: 'videos',
    label: 'Busca de vídeos',
    query: 'Como fazer pão de fermentação natural',
  },
];

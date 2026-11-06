import type { DiscoverLocale, DiscoverTopic } from './types';

/**
 * Built-in Discover topics, per interface language.
 *
 * To add or change a topic, edit this list and add its label under
 * `Discover.topics.<id>` in `src/i18n/messages/*.json`. Users can also hide
 * these topics and follow their own subjects from the Discover page.
 *
 * Feeds are public RSS/Atom URLs. The `fallback` SearXNG queries only run when
 * the feeds return too few articles (feed down, SearXNG still configured).
 */
export const discoverTopics: Record<DiscoverLocale, DiscoverTopic[]> = {
  'pt-BR': [
    {
      id: 'tech',
      feeds: [
        'https://g1.globo.com/rss/g1/tecnologia/',
        'https://rss.tecmundo.com.br/feed',
        'https://canaltech.com.br/rss/',
      ],
      fallback: {
        sites: [
          'g1.globo.com/tecnologia',
          'tecmundo.com.br',
          'canaltech.com.br',
        ],
        queries: ['tecnologia', 'inteligência artificial'],
      },
    },
    {
      id: 'finance',
      feeds: [
        'https://g1.globo.com/rss/g1/economia/',
        'https://www.infomoney.com.br/feed/',
        'https://feeds.folha.uol.com.br/mercado/rss091.xml',
        'https://exame.com/feed/',
      ],
      fallback: {
        sites: ['infomoney.com.br', 'exame.com', 'g1.globo.com/economia'],
        queries: ['economia', 'mercado financeiro'],
      },
    },
    {
      id: 'science',
      feeds: ['https://g1.globo.com/rss/g1/ciencia-e-saude/'],
      fallback: {
        sites: ['g1.globo.com/ciencia', 'revistapesquisa.fapesp.br'],
        queries: ['ciência', 'saúde', 'pesquisa científica'],
      },
    },
    {
      id: 'sports',
      feeds: [
        'https://ge.globo.com/rss/ge/',
        'https://feeds.folha.uol.com.br/esporte/rss091.xml',
      ],
      fallback: {
        sites: ['ge.globo.com', 'lance.com.br'],
        queries: ['futebol', 'esportes'],
      },
    },
    {
      id: 'art',
      feeds: [
        'https://feeds.folha.uol.com.br/ilustrada/rss091.xml',
        'https://g1.globo.com/rss/g1/pop-arte/',
      ],
      fallback: {
        sites: ['g1.globo.com/pop-arte', 'folha.uol.com.br/ilustrada'],
        queries: ['cultura', 'cinema', 'música'],
      },
    },
  ],
  en: [
    {
      id: 'tech',
      feeds: [
        'https://techcrunch.com/feed/',
        'https://www.wired.com/feed/rss',
        'https://www.theverge.com/rss/index.xml',
      ],
      fallback: {
        sites: ['techcrunch.com', 'wired.com', 'theverge.com'],
        queries: ['technology news', 'AI'],
      },
    },
    {
      id: 'finance',
      feeds: [
        'https://www.cnbc.com/id/10001147/device/rss/rss.html',
        'https://feeds.marketwatch.com/marketwatch/topstories/',
      ],
      fallback: {
        sites: ['bloomberg.com', 'cnbc.com', 'marketwatch.com'],
        queries: ['finance news', 'stock market'],
      },
    },
    {
      id: 'science',
      feeds: [
        'https://feeds.arstechnica.com/arstechnica/science',
        'https://www.sciencedaily.com/rss/top/science.xml',
      ],
      fallback: {
        sites: ['arstechnica.com', 'sciencedaily.com'],
        queries: ['science news', 'research'],
      },
    },
    {
      id: 'sports',
      feeds: [
        'https://www.espn.com/espn/rss/news',
        'https://feeds.bbci.co.uk/sport/rss.xml',
      ],
      fallback: {
        sites: ['espn.com', 'skysports.com'],
        queries: ['sports news', 'football'],
      },
    },
    {
      id: 'art',
      feeds: [
        'https://www.artnews.com/feed/',
        'https://hyperallergic.com/feed/',
      ],
      fallback: {
        sites: ['artnews.com', 'hyperallergic.com', 'theartnewspaper.com'],
        queries: ['art news', 'culture'],
      },
    },
    {
      id: 'entertainment',
      feeds: [
        'https://variety.com/feed/',
        'https://deadline.com/feed/',
        'https://www.hollywoodreporter.com/feed/',
      ],
      fallback: {
        sites: ['hollywoodreporter.com', 'variety.com', 'deadline.com'],
        queries: ['entertainment news', 'movies'],
      },
    },
  ],
};

export const toDiscoverLocale = (value: unknown): DiscoverLocale =>
  value === 'en' ? 'en' : 'pt-BR';

export const getDiscoverTopics = (locale: DiscoverLocale) =>
  discoverTopics[locale];

export const findDiscoverTopic = (locale: DiscoverLocale, id: string) =>
  discoverTopics[locale].find((topic) => topic.id === id);

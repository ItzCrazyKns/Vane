import { searchSearxng } from '@/lib/searxng';

const articleWebsites = [
  'yahoo.com',
  'www.exchangewire.com',
  'businessinsider.com',
  /* 'wired.com',
  'mashable.com',
  'theverge.com',
  'gizmodo.com',
  'cnet.com',
  'venturebeat.com', */
];

const topics = ['AI', 'tech']; /* TODO: Add UI to customize this */

export const GET = async (req: Request) => {
  try {
    const params = new URL(req.url).searchParams;
    const mode: 'normal' | 'preview' =
      (params.get('mode') as 'normal' | 'preview') || 'normal';

    let data = [];

    if (mode === 'normal') {
      data = (
        await Promise.all([
          ...new Array(articleWebsites.length * topics.length)
            .fill(0)
            .map(async (_, i) => {
              return (
                await searchSearxng(
                  `site:${articleWebsites[i % articleWebsites.length]} ${
                    topics[i % topics.length]
                  }`,
                  {
                    engines: ['bing news'],
                    pageno: 1,
                    language: 'en',
                  },
                )
              ).results;
            }),
        ])
      )
        .map((result) => result)
        .flat()
        .sort(() => Math.random() - 0.5);
    } else {
      data = (
        await searchSearxng(
          `site:${articleWebsites[Math.floor(Math.random() * articleWebsites.length)]} ${topics[Math.floor(Math.random() * topics.length)]}`,
          {
            engines: ['bing news'],
            pageno: 1,
            language: 'en',
          },
        )
      ).results;
    }

    return Response.json(
      {
        blogs: data,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error(`An error occurred in discover route: ${err}`);
    return Response.json(
      {
        message: 'An error has occurred',
      },
      {
        status: 500,
      },
    );
  }
};

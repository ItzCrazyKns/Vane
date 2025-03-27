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
    const data = (
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
                },
              )
            ).results;
          }),
      ])
    )
      .map((result) => result)
      .flat()
      .sort(() => Math.random() - 0.5);

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

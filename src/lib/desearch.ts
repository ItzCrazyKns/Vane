export interface DesearchResult {
  title: string;
  url: string;
  content: string;
}

/** A single web request. Credentials are never stored in application config. */
export const searchDesearch = async (query: string, num = 10) => {
  const key = process.env.DESEARCH_API_KEY;
  if (!key) throw new Error('DESEARCH_API_KEY is required for Desearch');
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('Desearch result count must be a positive integer');
  }

  const url = new URL('https://api.desearch.ai/web');
  url.searchParams.set('query', query);
  url.searchParams.set('num', String(num));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error(`Desearch HTTP ${response.status}`);
    }
    const body = await response.json();
    if (
      !Array.isArray(body?.data) ||
      !body.data.every(
        (item: any) =>
          item &&
          typeof item.title === 'string' &&
          typeof item.link === 'string' &&
          typeof item.snippet === 'string',
      )
    ) {
      throw new Error('Invalid Desearch response');
    }
    const results: DesearchResult[] = body.data.map(
      (item: { title: string; link: string; snippet: string }) => ({
        title: item.title,
        url: item.link,
        content: item.snippet,
      }),
    );
    return { results, suggestions: [] as string[] };
  } catch (error) {
    // Do not propagate transport errors or response bodies that may contain secrets.
    if (controller.signal.aborted) throw new Error('Desearch search timed out');
    if (
      error instanceof Error &&
      (/^Desearch HTTP \d{3}$/.test(error.message) ||
        error.message === 'Invalid Desearch response')
    ) {
      throw error;
    }
    throw new Error('Desearch search failed');
  } finally {
    clearTimeout(timeout);
  }
};

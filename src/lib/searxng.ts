import { getSearxngURL } from './config/serverRegistry';

interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  let searxngURL = getSearxngURL();

  if (!searxngURL) {
    console.error(
      '❌ SearXNG URL not configured. Please set it in config.toml or SEARXNG_API_URL env var.',
    );
    return { results: [], suggestions: [] };
  }

  // Validate and fix the URL
  searxngURL = searxngURL.trim();

  // Remove trailing slash
  searxngURL = searxngURL.replace(/\/$/, '');

  // Add protocol if missing
  if (!searxngURL.startsWith('http://') && !searxngURL.startsWith('https://')) {
    console.log(
      `⚠️ SearXNG URL missing protocol, adding http://: ${searxngURL}`,
    );
    searxngURL = `http://${searxngURL}`;
  }

  // Validate URL format
  let url: URL;
  const fullUrl = `${searxngURL}/search?format=json`;
  console.log(`🔗 Constructing SearXNG URL: ${fullUrl}`);

  try {
    url = new URL(fullUrl);
  } catch (error) {
    console.error(`❌ Invalid SearXNG URL: ${searxngURL}`);
    console.error(`❌ Full URL attempted: ${fullUrl}`);
    console.error(
      '   URL must be in format: http://hostname:port or https://hostname:port',
    );
    return { results: [], suggestions: [] };
  }
  url.searchParams.append('q', query);

  if (opts) {
    Object.keys(opts).forEach((key) => {
      const value = opts[key as keyof SearxngSearchOptions];
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
        return;
      }
      url.searchParams.append(key, value as string);
    });
  }

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    console.log(`🔍 Searching SearXNG: ${query.substring(0, 50)}...`);
    const startTime = Date.now();

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(
        `❌ SearXNG request failed: ${res.status} ${res.statusText}`,
      );
      return { results: [], suggestions: [] };
    }

    const data = await res.json();
    const duration = Date.now() - startTime;

    const results: SearxngSearchResult[] = data.results || [];
    const suggestions: string[] = data.suggestions || [];

    console.log(
      `✅ SearXNG search completed in ${duration}ms - Found ${results.length} results`,
    );

    return { results, suggestions };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.error('❌ SearXNG request timed out after 10 seconds');
      console.error(`   URL: ${url.toString()}`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ SearXNG connection refused - is the service running?');
      console.error(`   URL: ${url.toString()}`);
      console.error(`   Error: ${error.message}`);
    } else if (error.code === 'ENOTFOUND') {
      console.error('❌ SearXNG host not found - check the URL');
      console.error(`   URL: ${url.toString()}`);
      console.error(`   Error: ${error.message}`);
    } else {
      console.error('❌ SearXNG request failed:', error.message);
      console.error(`   URL: ${url.toString()}`);
      console.error(`   Error code: ${error.code || 'N/A'}`);
      if (error.cause) {
        console.error(`   Error cause:`, error.cause);
      }
    }

    return { results: [], suggestions: [] };
  }
};

/* Checks run before the benchmark cases: does each configured service
   answer the way the app expects? A wrong URL (SearXNG pointing at another
   service, localhost inside a container) otherwise only shows up mid-run as
   a generic error. Requests carry no user data and no API keys; only the
   status, content type and the first bytes of the body are looked at. */
import fs from 'node:fs';
import type { Finding } from './analyze';

export type ProbeInput = {
  searxngURL?: string;
  firecrawlURL?: string;
  bifrost?: { enabled: boolean; url: string };
  /** Whether image/video search (always SearXNG) or web search use SearXNG. */
  needsSearxng: boolean;
};

export type ProbeFetch = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 8000;

export const isInContainer = () => {
  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
};

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/i;

const parse = (u?: string) => {
  try {
    return u ? new URL(u) : null;
  } catch {
    return null;
  }
};

const errText = (err: any) =>
  String(
    err?.name === 'TimeoutError' || err?.name === 'AbortError'
      ? `sem resposta em ${TIMEOUT_MS / 1000} s`
      : (err?.cause?.code ?? err?.message ?? err),
  ).slice(0, 160);

export const runProbes = async (
  input: ProbeInput,
  opts: { inContainer?: boolean; fetch?: ProbeFetch } = {},
): Promise<Finding[]> => {
  const get = opts.fetch ?? ((url, init) => fetch(url, init));
  const inContainer = opts.inContainer ?? isInContainer();
  const out: Finding[] = [];
  const add = (f: Omit<Finding, 'cases'>) => out.push({ ...f, cases: [] });

  const services: { name: string; url: URL }[] = [];
  const searxng = parse(input.searxngURL);
  const firecrawl = parse(input.firecrawlURL);
  const bifrost = input.bifrost?.enabled ? parse(input.bifrost.url) : null;
  if (searxng) services.push({ name: 'SearXNG', url: searxng });
  if (firecrawl) services.push({ name: 'Firecrawl', url: firecrawl });
  if (bifrost) services.push({ name: 'Bifrost', url: bifrost });

  if (inContainer) {
    for (const s of services.filter((x) => LOOPBACK.test(x.url.hostname)))
      add({
        severity: 'bug',
        title: `${s.name} aponta para o próprio container`,
        detail: `A URL usa ${s.url.hostname}, mas o Vane roda em Docker: ali ${s.url.hostname} é o container, não a sua máquina. Use http://host.docker.internal:${s.url.port || (s.url.protocol === 'https:' ? '443' : '80')} (ou o nome do serviço no docker compose).`,
      });
  }

  if (searxng && bifrost && searxng.host === bifrost.host)
    add({
      severity: 'aviso',
      title: 'SearXNG e Bifrost no mesmo endereço',
      detail: `Os dois estão configurados em ${searxng.host}. Um processo só pode ouvir uma porta, então um dos dois está apontando para o serviço errado. Os dois usam a porta 8080 por padrão.`,
    });

  const probes: Promise<void>[] = [];

  if (searxng && input.needsSearxng) {
    probes.push(
      (async () => {
        const url = new URL(searxng.href.replace(/\/+$/, '') + '/search');
        url.searchParams.set('q', 'vane');
        url.searchParams.set('format', 'json');
        try {
          const res = await get(url.href, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          const type = res.headers.get('content-type') ?? '';
          const head = (await res.text()).trimStart().slice(0, 15);
          if (res.status === 403)
            add({
              severity: 'bug',
              title: 'SearXNG recusa o formato JSON',
              detail:
                'A SearXNG respondeu 403 a format=json. Adicione "json" em search.formats no settings.yml da SearXNG e reinicie.',
            });
          else if (!res.ok)
            add({
              severity: 'bug',
              title: 'SearXNG respondeu com erro',
              detail: `GET /search?format=json deu ${res.status}.`,
            });
          else if (!type.includes('json') || head.startsWith('<'))
            add({
              severity: 'bug',
              title: 'A URL da SearXNG não devolve JSON',
              detail: `${searxng.host} respondeu ${res.status} com ${type || 'tipo desconhecido'} ("${head.replace(/\s+/g, ' ')}…"). Provavelmente é outro serviço nessa porta. Busca de imagens, de vídeos e o Discover usam sempre a SearXNG e vão falhar.`,
            });
        } catch (err) {
          add({
            severity: 'bug',
            title: 'SearXNG inacessível',
            detail: `${searxng.host}: ${errText(err)}.`,
          });
        }
      })(),
    );
  }

  /* Firecrawl and Bifrost: only whether something answers. Any HTTP status
     counts; a search or scrape would spend credits. */
  for (const [name, u] of [
    ['Firecrawl', firecrawl],
    ['Bifrost', bifrost && new URL(bifrost.href.replace(/\/+$/, '') + '/mcp')],
  ] as const) {
    if (!u) continue;
    probes.push(
      (async () => {
        try {
          await get(u.href, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        } catch (err) {
          add({
            severity: 'bug',
            title: `${name} inacessível`,
            detail: `${u.host}: ${errText(err)}.${name === 'Bifrost' ? ' As ferramentas MCP não entram na pesquisa.' : ''}`,
          });
        }
      })(),
    );
  }

  await Promise.all(probes);
  return out;
};

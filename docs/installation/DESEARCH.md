# Desearch web search

Desearch is an optional backend for web research. The existing
backend remains the default. Image, video, and discover news searches retain their existing
backend.

Set `DESEARCH_API_KEY` in the server process environment using your deployment's
secret injection mechanism. The key is read only from the environment on each
request. Do not put it in application config, source files, or logs.

In Settings, select **Desearch** under **Web search backend**. You can also set
`search.backend` to `desearch` in `data/config.json`. For a fresh installation,
`SEARCH_BACKEND=desearch` seeds this setting. Environment settings only seed
missing config values; change an existing selection through Settings or config.
Restart the server after editing the config file. To revert, select **Default**
or set `search.backend` to `searxng`.

The adapter sends one GET request to `https://api.desearch.ai/web` with a `query`
parameter and a bearer authorization header. It caps results locally at 10
by default and maps `title`, `link`, and `snippet` to the app's title, URL, and
content fields. Direct callers can pass a positive integer as the second
argument to `searchDesearch` to choose the local result limit. The API may return fewer results.
The unsupported `num` parameter is never sent to the API.

The API wrapper does not translate engine, category, language, or pagination
options. Research modes that use those options receive general web results
when Desearch is selected. There are no retries or automatic fallback. Requests
time out after 10 seconds. Missing credentials, HTTP errors, and invalid
responses fail with sanitized messages.

## Public-page scraping

Desearch result URLs reject embedded credentials. Quality-mode scraping uses a
separate static HTML transport: only HTTP(S) on ports 80/443, public IP ranges,
and DNS answers containing exclusively public addresses are accepted. Connections
are pinned to a checked address with the original Host/TLS hostname. Redirects
are rejected, and HTML is parsed without executing scripts or loading frames or
subresources. Requests have a 20-second deadline and a 2 MiB response cap.
Pages requiring redirects or JavaScript rendering cannot be scraped through this
path. The same guard applies to explicit URL scraping while Desearch is selected, so
URLs passed through an LLM cannot lose the boundary. Other search backends
retain their existing scraping behavior.

## Isolated verification

Use Node.js 22 or newer. Install only the small test toolchain outside the app:

```sh
npm install --prefix /tmp/vane-desearch-tools --no-audit --no-fund tsx typescript @types/node
/tmp/vane-desearch-tools/node_modules/.bin/tsx --test tests/desearch/search.test.ts
node tests/desearch/scrape-boundary.test.cjs
```

The unit tests mock HTTP and cover request construction, mapping, empty results,
validation, error handling, timeouts, and backend routing. They do not call the
API. The boundary test bundles the actual adapter, search, quality action and
scraper with synthetic DNS/HTTP/config/LLM I/O. It opens no sockets and covers
private/numeric/IPv6 destinations, credentials, mixed DNS, rebinding, rejected
redirects and public controls. Run the live check with the credential already injected into the process
environment:

```sh
/tmp/vane-desearch-tools/node_modules/.bin/tsx tests/desearch/live_check.ts
```

The live check makes exactly one search for `bittensor` and prints only JSON
containing the result count and first title. It exits with status 1 on failure
without printing error details.

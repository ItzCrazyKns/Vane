# Desearch web search

Desearch is an optional backend for web research and discovery. The existing
backend remains the default. Image and video searches retain their existing
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

The adapter sends one GET request to `https://api.desearch.ai/web` with `query`
and `num` parameters and a bearer authorization header. It requests 10 results
by default and maps `title`, `link`, and `snippet` to the app's title, URL, and
content fields. Direct callers can pass a positive integer as the second
argument to `searchDesearch` to choose the requested count. The returned count
is determined by the API.

The API wrapper does not translate engine, category, language, or pagination
options. Research modes that use those options receive general web results
when Desearch is selected. There are no retries or automatic fallback. Requests
time out after 10 seconds. Missing credentials, HTTP errors, and invalid
responses fail with sanitized messages.

## Isolated verification

Use Node.js 22 or newer. Install only the small test toolchain outside the app:

```sh
npm install --prefix /tmp/vane-desearch-tools --no-audit --no-fund tsx typescript @types/node
/tmp/vane-desearch-tools/node_modules/.bin/tsx --test tests/desearch/search.test.ts
```

The unit tests mock HTTP and cover request construction, mapping, empty results,
validation, error handling, timeouts, and backend routing. They do not call the
API. Run the live check with the credential already injected into the process
environment:

```sh
/tmp/vane-desearch-tools/node_modules/.bin/tsx tests/desearch/live_check.ts
```

The live check makes exactly one search for `bittensor` and prints only JSON
containing the result count and first title. It exits with status 1 on failure
without printing error details.

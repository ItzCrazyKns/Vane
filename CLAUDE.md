# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vane is a self-hosted AI answering engine (Next.js 16 App Router, React 18, TypeScript, SQLite via Drizzle). It is a fork (`module195/Vane`) of `ItzCrazyKns/Vane` that adds a pt-BR interface, Firecrawl, a Bifrost gateway with MCP tools, and a benchmark/eval harness.

## Commands

The lockfile is `yarn.lock` and the Docker images build with `yarn install --frozen-lockfile`; `npm` also works for local runs.

```bash
yarn install
yarn dev                 # next dev on http://localhost:3000; finish setup in the UI
yarn build               # next build --webpack (webpack, not Turbopack)
yarn test                # vitest run (all tests)
yarn test:watch
npx vitest run src/lib/__tests__/searxng.test.ts   # one file
npx vitest run -t "name of the test"               # one test by name
npx vitest run -u        # update snapshots (src/lib/agents/search/__tests__/__snapshots__)
yarn format:write        # prettier: single quotes, trailing commas, 80 cols
yarn lint                # next lint
```

Vitest runs in a `node` environment, resolves `@/` to `src/`, and picks up `src/**/*.test.ts` and `perf-audit/eval/**/*.test.ts`. Tests use the deterministic fakes in `src/__tests__/helpers/fakes.ts` (`FakeLLM`, fake embedding, fake session) and `vi.mock` for SearXNG and other network calls, so they never hit a real model or search engine.

The quality eval in `perf-audit/eval/` runs against a real LLM (LM Studio or any OpenAI-compatible endpoint) with recorded SearXNG/page fixtures; see `perf-audit/eval/README.md` (`npx tsx perf-audit/eval/run.ts --label <name>`, then `checks.ts`, `judge.ts`, `compare.ts`).

## Runtime data and configuration

- State lives under `DATA_DIR` (default: cwd): `data/config.json` (settings) and `data/db.sqlite` (chats, messages). Uploads are the exception: `UploadManager` (`src/lib/uploads/manager.ts`) writes to `process.cwd()/data/uploads` regardless of `DATA_DIR`.
- `src/instrumentation.ts` runs `src/lib/db/migrate.ts` at server start. It is a hand-rolled runner that applies `drizzle/*.sql` in order and records them in a `ran_migrations` table. Schema is `src/lib/db/schema.ts`; generate new SQL with `drizzle-kit` into `drizzle/`.
- `src/lib/config/index.ts` (`ConfigManager`) owns `config.json` and also declares the UI settings sections (`uiConfigSections`). Some fields carry an `env` name (`SEARCH_PROVIDER`, `SEARXNG_API_URL`, `FIRECRAWL_API_URL`, `BIFROST_*`): env vars only seed empty values on first start, after which the saved setting wins. Server code reads config through helpers in `src/lib/config/serverRegistry.ts`; client code uses `clientRegistry.ts`.
- Model providers are configured in the UI, not via env. `src/lib/models/registry.ts` instantiates every configured provider from `src/lib/models/providers/index.ts` (OpenAI, Anthropic, Gemini, Groq, Ollama, LM Studio, Lemonade, Transformers) and appends Bifrost when it is enabled. A provider extends `BaseModelProvider` (`src/lib/models/base/provider.ts`) and returns `BaseLLM` / `BaseEmbedding` instances; it also exposes static `getProviderConfigFields` / `getProviderMetadata` / `parseAndValidate` used by the settings UI.

## Search pipeline (the core of the app)

`POST /api/chat` (`src/app/api/chat/route.ts`) validates the body with zod, loads models through `ModelRegistry`, creates a `SessionManager`, starts `SearchAgent.searchAsync` (`src/lib/agents/search/index.ts`) without awaiting it, and streams session events back as newline-delimited JSON.

1. **Classify** (`classifier.ts`): one structured LLM call decides `skipSearch`, which widgets apply, and a standalone rewrite of the question.
2. **Widgets and research run in parallel.**
   - Widgets (`widgets/`: weather, stock, calculation) emit `widget` blocks. Their output goes to the writer as context that must not be cited.
   - `Researcher` (`researcher/index.ts`) is a tool-calling loop: up to 2 / 6 / 25 iterations for `speed` / `balanced` / `quality`. Tools are `ResearchAction`s registered in `researcher/actions/index.ts` through `ActionRegistry`; each action decides its own availability from classification, mode, sources and uploaded file IDs. `done` ends the loop and `plan` (`__reasoning_preamble`) streams reasoning into the research block.
   - MCP tools are added at runtime by `syncMCPActions()` (`researcher/actions/mcp.ts`) as `mcp_<tool>` actions. Today the only MCP server is Bifrost's `/mcp` endpoint. Without an allow list only tools marked `readOnlyHint` are exposed, and results are truncated to 8000 chars.
3. **Write**: findings are numbered `<result index=N>` entries, and `getWriterPrompt` (`src/lib/prompts/search/writer.ts`) produces the system prompt. The answer streams into a `text` block, and the final blocks are saved to the `messages` row.

Web search goes through `searchWeb` in `src/lib/webSearch.ts`, which dispatches to SearXNG (`searxng.ts`) or Firecrawl (`firecrawlSearch.ts`) per the Search setting. Image search, video search and Discover always call SearXNG directly. Page reading (`scraper.ts`) uses Firecrawl scrape when `FIRECRAWL_API_URL` is set, otherwise a plain fetch plus Readability (no headless browser).

`src/lib/agents/search/api.ts` (`APISearchAgent`) is the variant behind the programmatic `POST /api/search` (documented in `docs/API/SEARCH.md`). Media and suggestion agents live in `src/lib/agents/media` and `src/lib/agents/suggestions`, with their prompts under `src/lib/prompts/`.

### Sessions and blocks

`SessionManager` (`src/lib/session.ts`) is an in-memory event emitter kept on `global` (30-minute TTL). The UI state is a list of typed `Block`s (`text`, `source`, `suggestion`, `widget`, and `research` with its sub-steps, in `src/lib/types.ts`). Agents call `emitBlock` for new blocks and `updateBlock` with RFC 6902 JSON patches for incremental changes. Every event is buffered, so `POST /api/reconnect/[id]` can replay a session for a client that reloads mid-answer. A re-sent message with an existing `messageId` deletes the later messages in that chat and regenerates the answer.

## Benchmark

`src/lib/benchmark/` instruments a real search end to end (`instrument.ts`, `runner.ts`), diagnoses configuration problems (`analyze.ts`), and builds a report. It is exposed via `POST /api/benchmark` (NDJSON stream) and the Benchmark section in Settings.

## Internationalization

UI strings use `next-intl`. Locales are `pt-BR` (default) and `en` (`src/i18n/config.ts`), chosen by the `NEXT_LOCALE` cookie, with messages in `src/i18n/messages/{pt-BR,en}.json`. Add a new UI string to both files and read it with `useTranslations` / `getTranslations`; do not hard-code user-facing text. Settings labels that come from `ConfigManager` are translated through `src/i18n/configText.ts`. Prompts stay in English but instruct the model to answer in the user's language.

## Conventions

- Commits follow Conventional Commits (`feat(scope): ...`, `test(eval): ...`). Recent work on this fork writes the subject in Portuguese.
- Architecture docs: `docs/architecture/README.md` and `WORKING.md`; contributor map: `CONTRIBUTING.md`.
- Docker: `Dockerfile` bundles SearXNG (started by `entrypoint.sh`); `Dockerfile.slim` expects an external `SEARXNG_API_URL`. CI (`.github/workflows/docker-build.yaml`) only builds and pushes images on `master`/`canary`; it does not run tests or lint.

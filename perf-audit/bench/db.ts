/**
 * Chat-history database benchmark.
 *
 *   npx tsx perf-audit/bench/db.ts [--chats 2000] [--messages 20] [--runs 5]
 *
 * Builds a throwaway SQLite database in a temp directory (BENCH_TMP or the OS
 * temp dir), seeds it with synthetic chats and messages whose responseBlocks
 * have realistic sizes, then calls the real route handlers and the real
 * `@/lib/db` connection (so the indexes in drizzle/ and the pragmas in
 * src/lib/db/index.ts of the checked-out code are what gets measured).
 * It never reads the user's data folder.
 *
 * Scenarios (each repeated --runs times; we print the median of the per-run
 * medians and the min..max spread across runs):
 *   list        GET /api/chats (no params, the UI's call)
 *   list-page   GET /api/chats?limit=50 (first page; ignored by older code)
 *   open        GET /api/chats/[id]
 *   end-update  the end-of-answer UPDATE messages SET status, responseBlocks
 *   delete      DELETE /api/chats/[id]
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};

const CHATS = arg('chats', 2000);
const MESSAGES = arg('messages', 20);
const RUNS = arg('runs', 5);
const LIST_CALLS = arg('list-calls', 10);
const OPEN_CALLS = arg('open-calls', 100);
const UPDATE_CALLS = arg('update-calls', 100);
const DELETE_CALLS = arg('delete-calls', 40);

/* Deterministic PRNG so every run seeds the same data. */
let seed = 42;
const rand = () => {
  /* mulberry32 */
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const randInt = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const WORDS =
  'the of and to in is for on that with as by from at this are be or an it which search result answer source model query data web page system user'.split(
    ' ',
  );
const words = (n: number) =>
  Array.from({ length: n }, () => WORDS[randInt(0, WORDS.length - 1)]).join(
    ' ',
  );
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () =>
    randInt(0, 15).toString(16),
  );

/* An answer roughly the size Vane stores: research steps, ~8 sources with
 * snippets, a 2-4 KB markdown answer and suggestions (~8 KB of JSON). */
const makeBlocks = () => [
  {
    id: uuid(),
    type: 'research',
    data: {
      subSteps: [
        { id: uuid(), type: 'reasoning', reasoning: words(60) },
        {
          id: uuid(),
          type: 'searching',
          searching: [words(5), words(6), words(4)],
        },
        {
          id: uuid(),
          type: 'search_results',
          reading: Array.from({ length: 6 }, () => ({
            content: '',
            metadata: { title: words(6), url: `https://ex.com/${uuid()}` },
          })),
        },
      ],
    },
  },
  {
    id: uuid(),
    type: 'source',
    data: Array.from({ length: 8 }, () => ({
      content: words(randInt(40, 90)),
      metadata: { title: words(7), url: `https://ex.com/${uuid()}` },
    })),
  },
  { id: uuid(), type: 'text', data: words(randInt(350, 650)) },
  {
    id: uuid(),
    type: 'suggestion',
    data: [words(8), words(9), words(7)],
  },
];

/* Schema as of migration 0002 (the hand-rolled runner special-cases 0001 and
 * 0002), then every later drizzle/*.sql applied statement by statement. */
const createSchema = (sqlite: Database.Database) => {
  sqlite.exec(`
    CREATE TABLE chats (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, createdAt TEXT NOT NULL,
      sources TEXT DEFAULT '[]', files TEXT DEFAULT '[]');
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY, messageId TEXT NOT NULL, chatId TEXT NOT NULL,
      backendId TEXT NOT NULL, query TEXT NOT NULL, createdAt TEXT NOT NULL,
      responseBlocks TEXT DEFAULT '[]', status TEXT DEFAULT 'answering');
  `);
  const dir = path.join(process.cwd(), 'drizzle');
  const later = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && Number(f.split('_')[0]) >= 3)
    .sort();
  for (const f of later) {
    fs.readFileSync(path.join(dir, f), 'utf-8')
      .split(/--> statement-breakpoint/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => sqlite.exec(s));
  }
  return later;
};

const seedDb = (file: string) => {
  const sqlite = new Database(file);
  const applied = createSchema(sqlite);
  const insChat = sqlite.prepare(
    'INSERT INTO chats (id, title, createdAt, sources, files) VALUES (?, ?, ?, ?, ?)',
  );
  const insMsg = sqlite.prepare(
    `INSERT INTO messages (messageId, chatId, backendId, query, createdAt, responseBlocks, status)
     VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
  );
  const chats: { id: string; messageIds: string[] }[] = [];
  const start = Date.parse('2025-01-01T00:00:00Z');
  sqlite.transaction(() => {
    for (let c = 0; c < CHATS; c++) {
      const id = uuid();
      const created = new Date(start + c * 3_600_000).toISOString();
      insChat.run(id, words(8), created, '["web"]', '[]');
      const messageIds: string[] = [];
      for (let m = 0; m < MESSAGES; m++) {
        const messageId = uuid();
        messageIds.push(messageId);
        insMsg.run(
          messageId,
          id,
          uuid(),
          words(12),
          created,
          JSON.stringify(makeBlocks()),
        );
      }
      chats.push({ id, messageIds });
    }
  })();
  sqlite.close();
  return { chats, applied };
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const time = async (fn: () => Promise<unknown> | unknown) => {
  const t0 = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - t0) / 1e6;
};

const main = async () => {
  const base = fs.mkdtempSync(
    path.join(process.env.BENCH_TMP || os.tmpdir(), 'vane-db-bench-'),
  );
  fs.mkdirSync(path.join(base, 'data'));
  const file = path.join(base, 'data', 'db.sqlite');

  const t0 = Date.now();
  const { chats, applied } = seedDb(file);
  const sizeMb = fs.statSync(file).size / 1024 / 1024;
  console.log(
    `seeded ${CHATS} chats x ${MESSAGES} messages (${sizeMb.toFixed(0)} MB) in ${Date.now() - t0} ms; migrations after 0002: ${applied.join(', ') || 'none'}`,
  );

  /* Import the app's own connection and handlers against the temp DB. */
  process.env.DATA_DIR = base;
  const { default: db } = await import('@/lib/db');
  const { messages } = await import('@/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const listRoute = await import('@/app/api/chats/route');
  const chatRoute = await import('@/app/api/chats/[id]/route');
  const client = (db as any).$client as Database.Database;
  console.log(
    `journal_mode=${client.pragma('journal_mode', { simple: true })} synchronous=${client.pragma('synchronous', { simple: true })}`,
  );

  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const pick = () => chats[randInt(0, chats.length - 1)];
  let deleteCursor = 0;
  const deletable = [...chats].reverse();

  const scenarios: Record<string, () => Promise<number[]>> = {
    list: async () => {
      const out: number[] = [];
      for (let i = 0; i < LIST_CALLS; i++)
        out.push(
          await time(async () => {
            const res = await listRoute.GET(
              new Request('http://localhost/api/chats'),
            );
            await res.text();
          }),
        );
      return out;
    },
    'list-page': async () => {
      const out: number[] = [];
      for (let i = 0; i < LIST_CALLS; i++)
        out.push(
          await time(async () => {
            const res = await listRoute.GET(
              new Request('http://localhost/api/chats?limit=50'),
            );
            await res.text();
          }),
        );
      return out;
    },
    open: async () => {
      const out: number[] = [];
      for (let i = 0; i < OPEN_CALLS; i++) {
        const c = pick();
        out.push(
          await time(async () => {
            const res = await chatRoute.GET(
              new Request(`http://localhost/api/chats/${c.id}`),
              params(c.id),
            );
            await res.text();
          }),
        );
      }
      return out;
    },
    'end-update': async () => {
      const out: number[] = [];
      for (let i = 0; i < UPDATE_CALLS; i++) {
        const c = pick();
        const messageId = c.messageIds[randInt(0, c.messageIds.length - 1)];
        const blocks = makeBlocks();
        out.push(
          await time(() =>
            db
              .update(messages)
              .set({ status: 'completed', responseBlocks: blocks as any })
              .where(
                and(
                  eq(messages.chatId, c.id),
                  eq(messages.messageId, messageId),
                ),
              )
              .execute(),
          ),
        );
      }
      return out;
    },
    delete: async () => {
      const out: number[] = [];
      for (let i = 0; i < DELETE_CALLS; i++) {
        const c = deletable[deleteCursor++];
        out.push(
          await time(async () => {
            const res = await chatRoute.DELETE(
              new Request(`http://localhost/api/chats/${c.id}`, {
                method: 'DELETE',
              }),
              params(c.id),
            );
            if (res.status !== 200) throw new Error(`delete ${res.status}`);
          }),
        );
      }
      return out;
    },
  };

  /* Deleted chats must not be picked by later open/update calls. */
  chats.splice(chats.length - RUNS * DELETE_CALLS);

  const results: Record<string, number[]> = {};
  for (let r = 0; r < RUNS; r++) {
    for (const [name, fn] of Object.entries(scenarios)) {
      (results[name] ||= []).push(median(await fn()));
    }
  }

  console.log('\nscenario     median-of-medians (ms)   spread across runs');
  for (const [name, meds] of Object.entries(results)) {
    console.log(
      `${name.padEnd(12)} ${median(meds).toFixed(3).padStart(10)}               ${Math.min(...meds).toFixed(3)} .. ${Math.max(...meds).toFixed(3)}`,
    );
  }

  client.close();
  fs.rmSync(base, { recursive: true, force: true });
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

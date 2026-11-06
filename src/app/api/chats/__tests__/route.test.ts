import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/lib/db/__tests__/testDb');
  return { default: createTestDb().db };
});

import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GET } from '../route';

const list = async (query = '') => {
  const res = await GET(new Request(`http://localhost/api/chats${query}`));
  return { status: res.status, body: await res.json() };
};

/* What the route returned before ordering moved to SQL. */
const legacyList = async () => (await db.query.chats.findMany()).reverse();

describe('GET /api/chats', () => {
  beforeEach(async () => {
    await db.delete(chats).run();
    const rows = [
      // Chats saved by older versions stored Date#toString(), which does
      // not sort as text; insertion order is the order the UI has shown.
      ['a', 'Thu Nov 27 2025 10:00:00 GMT+0000 (Coordinated Universal Time)'],
      ['b', 'Fri Nov 28 2025 10:00:00 GMT+0000 (Coordinated Universal Time)'],
      ['c', '2025-12-28T10:00:00.000Z'],
      ['d', '2026-01-02T10:00:00.000Z'],
      ['e', '2026-03-05T10:00:00.000Z'],
    ];
    for (const [id, createdAt] of rows) {
      await db.insert(chats).values({
        id,
        title: `chat ${id}`,
        createdAt,
        sources: ['web'],
        files: [],
      });
    }
  });

  it('without params returns every chat, newest first, as before', async () => {
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body).toEqual({
      chats: JSON.parse(JSON.stringify(await legacyList())),
    });
    expect(body.chats.map((c: { id: string }) => c.id)).toEqual([
      'e',
      'd',
      'c',
      'b',
      'a',
    ]);
    expect(Object.keys(body)).toEqual(['chats']);
  });

  it('pages with limit and cursor', async () => {
    const p1 = await list('?limit=2');
    expect(p1.status).toBe(200);
    expect(p1.body.chats.map((c: { id: string }) => c.id)).toEqual(['e', 'd']);
    expect(p1.body.chats[0]).toEqual({
      id: 'e',
      title: 'chat e',
      createdAt: '2026-03-05T10:00:00.000Z',
      sources: ['web'],
      files: [],
    });
    expect(typeof p1.body.nextCursor).toBe('string');

    const p2 = await list(`?limit=2&cursor=${p1.body.nextCursor}`);
    expect(p2.body.chats.map((c: { id: string }) => c.id)).toEqual(['c', 'b']);

    const p3 = await list(`?limit=2&cursor=${p2.body.nextCursor}`);
    expect(p3.body.chats.map((c: { id: string }) => c.id)).toEqual(['a']);
    expect(p3.body.nextCursor).toBeNull();
  });

  it('keeps paging when the cursor chat was deleted meanwhile', async () => {
    const p1 = await list('?limit=2');
    await db.delete(chats).where(eq(chats.id, 'd')).run();
    const p2 = await list(`?limit=2&cursor=${p1.body.nextCursor}`);
    expect(p2.status).toBe(200);
    expect(p2.body.chats.map((c: { id: string }) => c.id)).toEqual(['c', 'b']);
  });

  it('returns the rest after a cursor when no limit is given', async () => {
    const p1 = await list('?limit=3');
    const rest = await list(`?cursor=${p1.body.nextCursor}`);
    expect(rest.body.chats.map((c: { id: string }) => c.id)).toEqual([
      'b',
      'a',
    ]);
    expect(rest.body.nextCursor).toBeNull();
  });

  it.each(['?limit=0', '?limit=-1', '?limit=abc', '?limit=1.5', '?limit=501'])(
    'rejects an invalid limit (%s)',
    async (q) => {
      expect((await list(q)).status).toBe(400);
    },
  );

  it.each(['?cursor=abc', '?cursor=', '?cursor=-3'])(
    'rejects an invalid cursor (%s)',
    async (q) => {
      expect((await list(q)).status).toBe(400);
    },
  );
});

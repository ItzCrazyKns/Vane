import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createTestDb } = await import('@/lib/db/__tests__/testDb');
  return { default: createTestDb().db };
});

import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DELETE, GET } from '../route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const del = (id: string) =>
  DELETE(new Request(`http://localhost/api/chats/${id}`), ctx(id));

const seedChat = async (id: string, n: number) => {
  await db.insert(chats).values({
    id,
    title: `chat ${id}`,
    createdAt: new Date().toISOString(),
    sources: ['web'],
  });
  for (let i = 0; i < n; i++) {
    await db.insert(messages).values({
      messageId: `${id}-m${i}`,
      chatId: id,
      backendId: 'b',
      query: `q${i}`,
      createdAt: new Date().toISOString(),
      status: 'completed',
      responseBlocks: [{ id: 't', type: 'text', data: `answer ${i}` }],
    });
  }
};

const count = async (id: string) => ({
  chats: (await db.select().from(chats).where(eq(chats.id, id))).length,
  messages: (await db.select().from(messages).where(eq(messages.chatId, id)))
    .length,
});

describe('/api/chats/[id]', () => {
  beforeEach(async () => {
    await db.delete(messages).run();
    await db.delete(chats).run();
    await seedChat('keep', 2);
    await seedChat('gone', 3);
  });

  afterEach(() => {
    db.$client.exec('DROP TRIGGER IF EXISTS fail_message_delete');
  });

  it('GET returns the chat and its messages', async () => {
    const res = await GET(new Request('http://localhost'), ctx('gone'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.chat.id).toBe('gone');
    expect(body.messages.map((m: { query: string }) => m.query)).toEqual([
      'q0',
      'q1',
      'q2',
    ]);
  });

  it('DELETE removes the chat and only its messages', async () => {
    const res = await del('gone');
    expect(res.status).toBe(200);
    expect(await count('gone')).toEqual({ chats: 0, messages: 0 });
    expect(await count('keep')).toEqual({ chats: 1, messages: 2 });
  });

  it('DELETE of an unknown chat is a 404', async () => {
    expect((await del('nope')).status).toBe(404);
  });

  it('DELETE leaves nothing half-deleted when removing messages fails', async () => {
    db.$client.exec(`
      CREATE TRIGGER fail_message_delete BEFORE DELETE ON messages
      BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END;
    `);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await del('gone');

    expect(res.status).toBe(500);
    // The chat must still be there, with all its messages: no orphans.
    expect(await count('gone')).toEqual({ chats: 1, messages: 3 });
    errSpy.mockRestore();
  });
});

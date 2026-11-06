import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { messages } from '../schema';
import { createTestSqlite } from './testDb';

const plan = (sqlite: ReturnType<typeof createTestSqlite>, query: string) =>
  (sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all() as { detail: string }[])
    .map((r) => r.detail)
    .join('\n');

describe('messages.chatId index', () => {
  it('is declared in the schema', () => {
    const names = getTableConfig(messages).indexes.map((i) => i.config.name);
    expect(names).toContain('messages_chat_id_idx');
  });

  it('is used by the queries that filter messages by chat', () => {
    const sqlite = createTestSqlite();
    const queries = [
      // open chat (GET /api/chats/[id])
      "SELECT * FROM messages WHERE chatId = 'c'",
      // end-of-answer update and rewrite lookup (SearchAgent)
      "UPDATE messages SET status = 'completed' WHERE chatId = 'c' AND messageId = 'm'",
      // rewrite: drop the later messages of the chat
      "DELETE FROM messages WHERE chatId = 'c' AND id > 3",
      // delete chat
      "DELETE FROM messages WHERE chatId = 'c'",
    ];
    for (const q of queries) {
      expect(plan(sqlite, q)).toContain('USING INDEX messages_chat_id_idx');
    }
    sqlite.close();
  });
});

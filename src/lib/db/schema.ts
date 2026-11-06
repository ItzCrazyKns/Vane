import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export const messages = sqliteTable(
  'messages',
  {
    id: integer('id').primaryKey(),
    messageId: text('messageId').notNull(),
    chatId: text('chatId').notNull(),
    backendId: text('backendId').notNull(),
    query: text('query').notNull(),
    createdAt: text('createdAt').notNull(),
    responseBlocks: text('responseBlocks', { mode: 'json' })
      .$type<Block[]>()
      .default(sql`'[]'`),
    status: text({ enum: ['answering', 'completed', 'error'] }).default(
      'answering',
    ),
  },
  /* Every read, update and delete of messages filters by chatId (open chat,
   * end-of-answer update, rewrite, delete chat); without this index each one
   * scans the whole table, responseBlocks JSON included. */
  (t) => [index('messages_chat_id_idx').on(t.chatId)],
);

interface DBFile {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  sources: text('sources', {
    mode: 'json',
  })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
});

import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';
import type { AttachmentReindexRequired } from '../uploads/store';

export const messages = sqliteTable('messages', {
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
});

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

export const chatRecoveries = sqliteTable(
  'chat_recoveries',
  {
    id: integer('id').primaryKey(),
    backendId: text('backendId').notNull().unique(),
    chatId: text('chatId').notNull(),
    query: text('query').notNull(),
    errorFiles: text('errorFiles', { mode: 'json' })
      .$type<AttachmentReindexRequired['files']>()
      .notNull(),
    files: text('files', { mode: 'json' }).$type<DBFile[]>().notNull(),
    sources: text('sources', { mode: 'json' })
      .$type<SearchSources[]>()
      .notNull(),
  },
  (table) => [index('chat_recoveries_chat_id_idx').on(table.chatId)],
);

export type ChatRecovery = typeof chatRecoveries.$inferSelect;

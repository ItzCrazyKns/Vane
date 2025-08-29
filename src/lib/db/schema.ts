import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Document } from 'langchain/document';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  role: text('type', { enum: ['assistant', 'user', 'source'] }).notNull(),
  chatId: text('chatId').notNull(),
  createdAt: text('createdAt').notNull(),
  messageId: text('messageId').notNull(),

  content: text('content'),

  sources: text('sources', {
    mode: 'json',
  }).$type<Document[]>(),
});

interface File {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  focusMode: text('focusMode').notNull(),
  files: text('files', { mode: 'json' })
    .$type<File[]>()
    .default(sql`'[]'`),
});

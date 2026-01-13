import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

// User settings stored as JSON in the users table
export interface UserSettings {
  theme?: 'light' | 'dark';
  measureUnit?: 'Imperial' | 'Metric';
  autoMediaSearch?: boolean;
  showWeatherWidget?: boolean;
  showNewsWidget?: boolean;
  systemInstructions?: string;
  chatModelKey?: string;
  chatModelProviderId?: string;
  embeddingModelKey?: string;
  embeddingModelProviderId?: string;
}

// Users table - stores user profile information
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role', { enum: ['user', 'admin'] })
    .notNull()
    .default('user'),
  settings: text('settings', { mode: 'json' })
    .$type<UserSettings>()
    .default(sql`'{}'`),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

// Auth table - stores authentication credentials (separate for security)
export const auth = sqliteTable('auth', {
  id: integer('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

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
  userId: text('userId').references(() => users.id, { onDelete: 'cascade' }), // Nullable for migration
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

// Audit log event types
export type AuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'register'
  | 'password_change'
  | 'role_change'
  | 'user_delete'
  | 'admin_action';

// Audit logs table - tracks authentication and admin events
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey(),
  eventType: text('eventType').$type<AuditEventType>().notNull(),
  userId: text('userId').references(() => users.id, { onDelete: 'set null' }), // Nullable if user deleted
  targetUserId: text('targetUserId'), // For admin actions on other users
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('createdAt').notNull(),
});

-- Rebuild messages table with FK constraint on chatId → chats(id) with CASCADE
-- and add index on chatId for query performance.
-- Orphaned messages (chatId not in chats) are silently dropped.
CREATE TABLE IF NOT EXISTS messages_new (
  id INTEGER PRIMARY KEY,
  messageId TEXT NOT NULL,
  chatId TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  backendId TEXT NOT NULL,
  query TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  responseBlocks TEXT DEFAULT '[]',
  status TEXT DEFAULT 'answering'
);
--> statement-breakpoint
INSERT INTO messages_new (id, messageId, chatId, backendId, query, createdAt, responseBlocks, status)
  SELECT m.id, m.messageId, m.chatId, m.backendId, m.query, m.createdAt, m.responseBlocks, m.status
  FROM messages m
  WHERE EXISTS (SELECT 1 FROM chats c WHERE c.id = m.chatId);
--> statement-breakpoint
DROP TABLE messages;
--> statement-breakpoint
ALTER TABLE messages_new RENAME TO messages;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);

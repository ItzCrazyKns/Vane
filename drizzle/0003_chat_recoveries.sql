CREATE TABLE IF NOT EXISTS `chat_recoveries` (
  `id` integer PRIMARY KEY NOT NULL,
  `backendId` text NOT NULL,
  `chatId` text NOT NULL,
  `query` text NOT NULL,
  `errorFiles` text NOT NULL,
  `files` text NOT NULL,
  `sources` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `chat_recoveries_backendId_unique` ON `chat_recoveries` (`backendId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chat_recoveries_chat_id_idx` ON `chat_recoveries` (`chatId`);

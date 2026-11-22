CREATE TABLE IF NOT EXISTS `chat_recoveries` (
  `id` integer PRIMARY KEY NOT NULL,
  `backendId` text NOT NULL UNIQUE,
  `chatId` text NOT NULL,
  `query` text NOT NULL,
  `errorFiles` text NOT NULL,
  `files` text NOT NULL,
  `sources` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chat_recoveries_chat_id_idx` ON `chat_recoveries` (`chatId`);

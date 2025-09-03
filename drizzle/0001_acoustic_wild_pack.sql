PRAGMA foreign_keys=OFF;
--> statement-breakpoint

CREATE TABLE `__new_messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`chatId` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`messageId` text NOT NULL,
	`content` text,
	`sources` text DEFAULT '[]'
);
--> statement-breakpoint

INSERT INTO `__new_messages`("id", "type", "chatId", "createdAt", "messageId", "content", "sources") 
SELECT 
    id,
    COALESCE(type, 'user') as type,
    chatId,
    CASE
        WHEN metadata IS NOT NULL AND instr(metadata, '\"createdAt\":\"') > 0 THEN
            substr(
                metadata,
                instr(metadata, '\"createdAt\":\"') + 14,
                CASE
                    WHEN instr(substr(metadata, instr(metadata, '\"createdAt\":\"') + 14), '\"') > 0 THEN
                        instr(substr(metadata, instr(metadata, '\"createdAt\":\"') + 14), '\"') - 1
                    ELSE 24
                END
            )
        ELSE CURRENT_TIMESTAMP
    END as createdAt,
    messageId,
    content,
    '[]' as sources
FROM `messages`;
--> statement-breakpoint

DROP TABLE `messages`;
--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;
--> statement-breakpoint

PRAGMA foreign_keys=ON;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_messages_chatId` ON `messages` (`chatId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_messages_type` ON `messages` (`type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_messages_createdAt` ON `messages` (`createdAt`);
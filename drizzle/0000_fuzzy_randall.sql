CREATE TABLE IF NOT EXISTS `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`createdAt` text NOT NULL,
	`focusMode` text NOT NULL,
	`files` text DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`chatId` text NOT NULL,
	`messageId` text NOT NULL,
	`type` text,
	`metadata` text
);

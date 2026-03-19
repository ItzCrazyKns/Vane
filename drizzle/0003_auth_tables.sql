CREATE TABLE IF NOT EXISTS `users` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `username` TEXT NOT NULL UNIQUE,
  `passwordHash` TEXT NOT NULL,
  `role` TEXT NOT NULL DEFAULT 'user',
  `createdAt` TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `userId` TEXT NOT NULL REFERENCES `users`(`id`),
  `expiresAt` TEXT NOT NULL,
  `createdAt` TEXT NOT NULL
);
--> statement-breakpoint
ALTER TABLE `chats` ADD COLUMN `userId` TEXT;

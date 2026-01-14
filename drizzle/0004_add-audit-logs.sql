CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`eventType` text NOT NULL,
	`userId` text,
	`targetUserId` text,
	`ipAddress` text,
	`userAgent` text,
	`details` text,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);

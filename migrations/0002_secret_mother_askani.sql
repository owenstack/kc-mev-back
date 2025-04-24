CREATE TABLE `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`planType` text DEFAULT 'free' NOT NULL,
	`planDuration` text,
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`status` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `user` ADD `appPassphrase` text;--> statement-breakpoint
ALTER TABLE `user` ADD `importedPassphrase` text;--> statement-breakpoint
ALTER TABLE `user` ADD `balance` real DEFAULT 0 NOT NULL;
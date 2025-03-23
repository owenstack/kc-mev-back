ALTER TABLE `user` ADD `username` text NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `displayUsername` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);
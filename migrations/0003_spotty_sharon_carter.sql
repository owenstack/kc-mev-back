ALTER TABLE `user` ADD `mnemonic` text;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `appPassphrase`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `importedPassphrase`;
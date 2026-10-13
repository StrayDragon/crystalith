ALTER TABLE `chunks` ADD `modality` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `chunks` ADD `embedding_model` text;--> statement-breakpoint
ALTER TABLE `chunks` ADD `embedding_dims` integer;--> statement-breakpoint
ALTER TABLE `chunks` ADD `origin_type` text DEFAULT 'source' NOT NULL;--> statement-breakpoint
ALTER TABLE `chunks` ADD `origin_id` integer;--> statement-breakpoint
-- Backfill: pre-migration chunks originate from their own source (origin generalization lands in c132)
UPDATE `chunks` SET `origin_id` = `source_id` WHERE `origin_id` IS NULL;

ALTER TABLE `sources` ADD `derived_output_id` integer;--> statement-breakpoint
CREATE INDEX `ix_sources_derived_output_id` ON `sources` (`derived_output_id`);

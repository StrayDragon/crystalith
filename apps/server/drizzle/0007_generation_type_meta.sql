ALTER TABLE `outputs` ADD `generation_meta` text;
--> statement-breakpoint
ALTER TABLE `prompt_presets` ADD `generation_type_id` text DEFAULT 'qa' NOT NULL;

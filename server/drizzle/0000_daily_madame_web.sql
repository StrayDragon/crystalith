CREATE TABLE `chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`chunk_index` integer NOT NULL,
	`text` text NOT NULL,
	`start_offset` integer,
	`end_offset` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_chunks_source_id_chunk_index` ON `chunks` (`source_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `ix_chunks_source_id_chunk_index` ON `chunks` (`source_id`,`chunk_index`);--> statement-breakpoint
CREATE TABLE `eval_datasets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`notebook_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `eval_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dataset_id` integer NOT NULL,
	`question` text NOT NULL,
	`expected_answer` text NOT NULL,
	`expected_sources` text,
	`notebook_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`dataset_id`) REFERENCES `eval_datasets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_eval_items_dataset_id` ON `eval_items` (`dataset_id`);--> statement-breakpoint
CREATE TABLE `eval_run_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`strategy_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`retrieved_source_ids` text DEFAULT '[]' NOT NULL,
	`metrics` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `eval_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `eval_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_eval_run_items_run_id_strategy_id` ON `eval_run_items` (`run_id`,`strategy_id`);--> statement-breakpoint
CREATE TABLE `eval_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dataset_id` integer NOT NULL,
	`strategy_ids` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`summary` text,
	FOREIGN KEY (`dataset_id`) REFERENCES `eval_datasets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_eval_runs_dataset_id` ON `eval_runs` (`dataset_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`citations` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_messages_session_id_created_at` ON `messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notebook_extractor_policies` (
	`notebook_id` integer PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'inherit_global' NOT NULL,
	`enabled_extractors` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notebooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_notebooks_name` ON `notebooks` (`name`);--> statement-breakpoint
CREATE TABLE `outputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`type` text NOT NULL,
	`prompt` text,
	`chunk_ids` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_outputs_notebook_id_created_at` ON `outputs` (`notebook_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `prompt_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trigger` text NOT NULL,
	`description` text,
	`system_prompt` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_presets_trigger_unique` ON `prompt_presets` (`trigger`);--> statement-breakpoint
CREATE INDEX `ix_prompt_presets_enabled` ON `prompt_presets` (`enabled`);--> statement-breakpoint
CREATE INDEX `ix_prompt_presets_trigger` ON `prompt_presets` (`trigger`);--> statement-breakpoint
CREATE TABLE `research_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`topic` text NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`current_iteration` integer DEFAULT 1 NOT NULL,
	`max_iterations` integer DEFAULT 4 NOT NULL,
	`aggregated_results` text,
	`final_report` text,
	`locked_at` integer,
	`lock_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_research_sessions_status` ON `research_sessions` (`status`);--> statement-breakpoint
CREATE TABLE `research_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`iteration` integer NOT NULL,
	`type` text NOT NULL,
	`input_data` text,
	`output_data` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `research_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_research_steps_session_iteration` ON `research_steps` (`session_id`,`iteration`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`title` text,
	`shared_state` text DEFAULT '{}' NOT NULL,
	`shared_state_revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_sessions_notebook_id_updated_at` ON `sessions` (`notebook_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `source_connector_bindings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`connector_id` text NOT NULL,
	`connection_config` text NOT NULL,
	`import_scope` text,
	`last_confirmed_snapshot` text,
	`last_sync_check_result` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_source_connector_bindings_notebook_id_connector_id` ON `source_connector_bindings` (`notebook_id`,`connector_id`);--> statement-breakpoint
CREATE TABLE `source_tag_map` (
	`source_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`source_id`, `tag_id`),
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `source_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_source_tag_map_tag_id` ON `source_tag_map` (`tag_id`);--> statement-breakpoint
CREATE TABLE `source_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_source_tags_notebook_id_name` ON `source_tags` (`notebook_id`,`name`);--> statement-breakpoint
CREATE INDEX `ix_source_tags_notebook_id_name` ON `source_tags` (`notebook_id`,`name`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text,
	`parser_type` text DEFAULT 'text' NOT NULL,
	`metadata` text,
	`dedup_key` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`error_code` text,
	`error_message` text,
	`recovery_hint` text,
	`last_error_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_sources_notebook_id_status` ON `sources` (`notebook_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_sources_notebook_id_dedup_key` ON `sources` (`notebook_id`,`dedup_key`);--> statement-breakpoint
CREATE TABLE `studio_slides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`output_id` integer,
	`title` text,
	`prompt` text,
	`engine` text DEFAULT 'slidev' NOT NULL,
	`chunk_ids` text,
	`source_ids` text,
	`outline` text,
	`markdown` text,
	`generation_config` text,
	`stage` text DEFAULT 'input' NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`output_id`) REFERENCES `outputs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ix_studio_slides_notebook_id_updated_at` ON `studio_slides` (`notebook_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text NOT NULL,
	`result` text,
	`error` text,
	`progress` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ix_tasks_notebook_id_status` ON `tasks` (`notebook_id`,`status`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config_json` text NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_templates_is_builtin` ON `templates` (`is_builtin`);

ALTER TABLE `research_runs` ADD `active_revision_id` text;--> statement-breakpoint
ALTER TABLE `research_runs` ADD `active_node_id` text;--> statement-breakpoint
ALTER TABLE `research_runs` ADD `llm_activity` text;--> statement-breakpoint
ALTER TABLE `research_runs` ADD `report_updated_at` integer;--> statement-breakpoint
CREATE TABLE `research_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` integer NOT NULL,
	`notebook_id` integer NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`parent_revision_id` text,
	`graph` text NOT NULL,
	`report` text,
	`searches_used` integer DEFAULT 0 NOT NULL,
	`status_at_save` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_research_revisions_run_id_created_at` ON `research_revisions` (`run_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `research_report_edits` (
	`run_id` integer PRIMARY KEY NOT NULL,
	`base_report_updated_at` integer,
	`report` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`run_id`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `research_progress_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` integer NOT NULL,
	`seq` integer NOT NULL,
	`at` integer NOT NULL,
	`kind` text NOT NULL,
	`node_id` text,
	`headline` text,
	`payload` text,
	FOREIGN KEY (`run_id`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_progress_events_run_id_seq` ON `research_progress_events` (`run_id`,`seq`);
--> statement-breakpoint
CREATE INDEX `ix_research_progress_events_run_id_at` ON `research_progress_events` (`run_id`,`at`);

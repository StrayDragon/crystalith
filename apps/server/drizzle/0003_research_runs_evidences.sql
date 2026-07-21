CREATE TABLE `research_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`topic` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`use_notebook_sources` integer DEFAULT true NOT NULL,
	`allow_web` integer DEFAULT true NOT NULL,
	`source_ids` text,
	`depth` text DEFAULT 'medium' NOT NULL,
	`max_searches` integer NOT NULL,
	`max_nodes` integer NOT NULL,
	`searches_used` integer DEFAULT 0 NOT NULL,
	`graph` text,
	`checkpoint` text,
	`report` text,
	`confirm_kind` text,
	`confirm_branch_node_id` text,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_research_runs_notebook_id_updated_at` ON `research_runs` (`notebook_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `research_evidences` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` integer NOT NULL,
	`notebook_id` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`snippet` text,
	`url` text,
	`source_id` integer,
	`chunk_id` text,
	`collected_at_node_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_research_evidences_run_id` ON `research_evidences` (`run_id`);
--> statement-breakpoint
CREATE INDEX `ix_research_evidences_notebook_id` ON `research_evidences` (`notebook_id`);

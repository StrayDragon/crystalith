CREATE TABLE `index_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`notebook_id` integer NOT NULL,
	`mode` text NOT NULL,
	`state` text NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `ix_index_jobs_notebook_id_id` ON `index_jobs` (`notebook_id`,`id`);

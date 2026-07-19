CREATE TABLE IF NOT EXISTS `strategy_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`strategy_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_strategy_configs_notebook_id` ON `strategy_configs` (`notebook_id`);

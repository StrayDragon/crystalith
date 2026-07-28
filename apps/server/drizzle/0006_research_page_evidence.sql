ALTER TABLE `research_evidences` ADD `content` text;
--> statement-breakpoint
ALTER TABLE `research_runs` ADD `pages_used` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `research_runs` ADD `max_page_fetches` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- Backfill: max_page_fetches = max(1, ceil(max_searches * 1.5))
UPDATE `research_runs` SET `max_page_fetches` = MAX(1, (`max_searches` * 3 + 1) / 2);

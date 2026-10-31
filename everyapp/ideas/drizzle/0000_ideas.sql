CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`title` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'idea' NOT NULL,
	`target_date` text,
	`added_by_id` text NOT NULL,
	`added_by_email` text NOT NULL,
	`added_at` text NOT NULL,
	`changed_by_id` text NOT NULL,
	`changed_by_email` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ideas_org_status_idx` ON `ideas` (`org_id`,`status`);
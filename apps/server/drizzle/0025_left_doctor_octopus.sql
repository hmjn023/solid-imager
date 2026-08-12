DELETE FROM "jobs"
WHERE "type" IN ('sync_lancedb', 'sync_lancedb_full', 'sync_lancedb_delta')
	OR (
		"type" IN ('source_export', 'source_restore')
		AND "payload"->>'mode' = 'lancedb'
	);--> statement-breakpoint
ALTER TABLE "lancedb_sync_dirty" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lancedb_sync_dirty" CASCADE;--> statement-breakpoint
DROP INDEX "idx_jobs_pending_lancedb_source";--> statement-breakpoint
DROP INDEX "idx_jobs_active_lancedb_source";

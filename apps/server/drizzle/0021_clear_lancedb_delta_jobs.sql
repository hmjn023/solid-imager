DELETE FROM "jobs" WHERE "type" = 'sync_lancedb_delta';--> statement-breakpoint
DELETE FROM "lancedb_sync_dirty";

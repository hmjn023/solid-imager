CREATE INDEX "idx_jobs_pending_created" ON "jobs" USING btree ("created_at","id") WHERE "jobs"."status" = 'pending' AND "jobs"."type" <> 'import_request';--> statement-breakpoint
CREATE INDEX "idx_jobs_pending_type_created" ON "jobs" USING btree ("type","created_at","id") WHERE "jobs"."status" = 'pending' AND "jobs"."type" <> 'import_request';--> statement-breakpoint
CREATE INDEX "idx_jobs_pending_lancedb_source" ON "jobs" USING btree ("source_id","created_at","id") WHERE "jobs"."status" = 'pending'
					AND "jobs"."type" IN ('sync_lancedb', 'sync_lancedb_full', 'sync_lancedb_delta')
					AND "jobs"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_jobs_active_lancedb_source" ON "jobs" USING btree ("source_id") WHERE "jobs"."status" = 'in_progress'
					AND "jobs"."type" IN ('sync_lancedb', 'sync_lancedb_full', 'sync_lancedb_delta')
					AND "jobs"."source_id" IS NOT NULL;
DROP INDEX "uq_jobs_active_thumbnail";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_active_thumbnail" ON "jobs" USING btree ("source_id",("payload"->>'mediaId'),("payload"->>'size')) WHERE "jobs"."type" = 'generate_thumbnail'
					AND "jobs"."status" IN ('pending', 'in_progress')
					AND "jobs"."source_id" IS NOT NULL;
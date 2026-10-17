SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "jobs" SET LOGGED;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "processing_checkpoint" jsonb;--> statement-breakpoint
CREATE INDEX "idx_jobs_unfinished_processing_media" ON "jobs" USING btree ("source_id",("payload"->>'mediaId')) WHERE "jobs"."type" = 'processMedia' AND "jobs"."status" IN ('pending', 'in_progress', 'failed');

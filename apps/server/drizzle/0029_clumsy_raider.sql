DROP INDEX "idx_media_source_id";--> statement-breakpoint
CREATE INDEX "idx_jobs_parent_type" ON "jobs" USING btree ("parent_id","type") WHERE "jobs"."parent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_media_source_created_at_id" ON "media" USING btree ("source_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_media_source_id" ON "media" USING btree ("source_id","id");
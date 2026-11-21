CREATE TYPE "public"."media_source_sync_status" AS ENUM('idle', 'syncing', 'error');--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'cancelled';--> statement-breakpoint
DROP INDEX "uq_jobs_active_thumbnail";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cancel_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "finished_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "artifact_path" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "artifact_file_name" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "artifact_content_type" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "artifact_size" bigint;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "artifact_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "media_sources" ADD COLUMN "sync_status" "media_source_sync_status" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_sources" ADD COLUMN "last_sync_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "media_sources" ADD COLUMN "last_sync_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "media_sources" ADD COLUMN "last_sync_error" text;--> statement-breakpoint
CREATE INDEX "idx_jobs_cancelable" ON "jobs" USING btree ("status","updated_at") WHERE "jobs"."status" IN ('pending', 'in_progress');--> statement-breakpoint
CREATE INDEX "idx_jobs_artifact_expiry" ON "jobs" USING btree ("artifact_expires_at") WHERE "jobs"."artifact_path" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_active_thumbnail" ON "jobs" USING btree ("source_id",("payload"->>'mediaId'),("payload"->>'size')) WHERE "jobs"."type" = 'generate_thumbnail'
					AND "jobs"."status" IN ('pending', 'in_progress')
				AND "jobs"."source_id" IS NOT NULL;
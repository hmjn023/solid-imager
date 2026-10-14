CREATE TABLE "source_run_cutovers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"authority" text DEFAULT 'legacy' NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_run_authority" CHECK ("source_run_cutovers"."authority" IN ('legacy','dedicated')),
	CONSTRAINT "source_run_epoch" CHECK ("source_run_cutovers"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "source_run_leases" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid,
	"kind" text,
	"token" uuid,
	"expires_at" timestamp,
	CONSTRAINT "source_owner_lease" CHECK (("source_run_leases"."token" IS NULL AND "source_run_leases"."run_id" IS NULL AND "source_run_leases"."expires_at" IS NULL AND "source_run_leases"."kind" IS NULL) OR ("source_run_leases"."token" IS NOT NULL AND "source_run_leases"."run_id" IS NOT NULL AND "source_run_leases"."expires_at" IS NOT NULL AND "source_run_leases"."kind" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "source_run_legacy_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"kind" text NOT NULL,
	"input" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"checkpoint" jsonb DEFAULT '{"offset":0,"added":0,"deleted":0,"processed":0,"skipped":0,"filesComplete":false,"fileCursor":null}'::jsonb NOT NULL,
	"artifact" jsonb,
	"failure_code" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp,
	"retention_expires_at" timestamp,
	"cancel_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "sync_run_kind" CHECK ("source_sync_runs"."kind" = 'sync'),
	CONSTRAINT "sync_run_status" CHECK ("source_sync_runs"."status" IN ('pending','in_progress','completed','failed','cancelled','blocked')),
	CONSTRAINT "sync_run_input" CHECK ("source_sync_runs"."status" IN ('blocked','failed','completed','cancelled') OR ("source_sync_runs"."input"->>'kind' = 'sync' AND "source_sync_runs"."source_id" IS NOT NULL)),
	CONSTRAINT "sync_run_lease" CHECK (("source_sync_runs"."lease_token" IS NULL) = ("source_sync_runs"."lease_expires_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "source_sync_watermarks" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"generation" bigint DEFAULT 0 NOT NULL,
	"requested_generation" bigint DEFAULT 0 NOT NULL,
	"applied_generation" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "source_watermark_order" CHECK ("source_sync_watermarks"."applied_generation" >= 0 AND "source_sync_watermarks"."requested_generation" >= 0 AND "source_sync_watermarks"."generation" >= "source_sync_watermarks"."requested_generation" AND "source_sync_watermarks"."generation" >= "source_sync_watermarks"."applied_generation")
);
--> statement-breakpoint
CREATE TABLE "source_transfer_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"kind" text NOT NULL,
	"input" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"checkpoint" jsonb DEFAULT '{"offset":0,"added":0,"deleted":0,"processed":0,"skipped":0,"filesComplete":false,"fileCursor":null}'::jsonb NOT NULL,
	"artifact" jsonb,
	"failure_code" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp,
	"retention_expires_at" timestamp,
	"cancel_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "transfer_run_kind" CHECK ("source_transfer_runs"."kind" IN ('export','restore')),
	CONSTRAINT "transfer_run_status" CHECK ("source_transfer_runs"."status" IN ('pending','in_progress','completed','failed','cancelled','blocked')),
	CONSTRAINT "transfer_run_input" CHECK ("source_transfer_runs"."status" IN ('blocked','failed','completed','cancelled') OR ("source_transfer_runs"."input"->>'kind' = "source_transfer_runs"."kind" AND "source_transfer_runs"."source_id" IS NOT NULL)),
	CONSTRAINT "transfer_run_lease" CHECK (("source_transfer_runs"."lease_token" IS NULL) = ("source_transfer_runs"."lease_expires_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sync_run_pending" ON "source_sync_runs" USING btree ("source_id") WHERE "source_sync_runs"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_sync_run_claim" ON "source_sync_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_sync_run_source" ON "source_sync_runs" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_transfer_run_claim" ON "source_transfer_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_transfer_run_source" ON "source_transfer_runs" USING btree ("source_id","created_at");
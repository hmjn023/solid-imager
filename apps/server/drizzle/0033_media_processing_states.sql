CREATE TABLE "media_processing_states" (
	"media_id" uuid NOT NULL,
	"task_kind" text NOT NULL,
	"status" text NOT NULL,
	"input_revision" text NOT NULL,
	"requested_revision" text NOT NULL,
	"completed_revision" text,
	"claim_token" uuid,
	"claimed_at" timestamp,
	"heartbeat_at" timestamp,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"owner_job_id" uuid,
	"owner_attempt_count" integer,
	"last_error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_processing_states_media_id_task_kind_pk" PRIMARY KEY("media_id","task_kind"),
	CONSTRAINT "media_processing_kind" CHECK ("media_processing_states"."task_kind" IN ('metadata', 'thumbnail')),
	CONSTRAINT "media_processing_status" CHECK ("media_processing_states"."status" IN ('pending', 'in_progress', 'completed', 'failed')),
	CONSTRAINT "media_processing_attempt" CHECK ("media_processing_states"."attempt_count" >= 0),
	CONSTRAINT "media_processing_claim" CHECK (("media_processing_states"."status" = 'in_progress' AND "media_processing_states"."claim_token" IS NOT NULL AND "media_processing_states"."claimed_at" IS NOT NULL AND "media_processing_states"."heartbeat_at" IS NOT NULL) OR ("media_processing_states"."status" <> 'in_progress' AND "media_processing_states"."claim_token" IS NULL AND "media_processing_states"."claimed_at" IS NULL AND "media_processing_states"."heartbeat_at" IS NULL)),
	CONSTRAINT "media_processing_owner" CHECK (("media_processing_states"."owner_job_id" IS NULL AND "media_processing_states"."owner_attempt_count" IS NULL) OR ("media_processing_states"."owner_job_id" IS NOT NULL AND "media_processing_states"."owner_attempt_count" IS NOT NULL AND "media_processing_states"."owner_attempt_count" >= 0)),
	CONSTRAINT "media_processing_completed" CHECK ("media_processing_states"."status" <> 'completed' OR ("media_processing_states"."completed_revision" IS NOT NULL AND "media_processing_states"."completed_revision" = "media_processing_states"."requested_revision"))
);
--> statement-breakpoint
ALTER TABLE "media_processing_states" ADD CONSTRAINT "media_processing_states_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
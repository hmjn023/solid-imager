CREATE TABLE "batch_item_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"attempt_count" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"requested_revision" text NOT NULL,
	"status" text NOT NULL,
	"failure_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "uq_batch_item_attempt" UNIQUE("item_id","attempt_count")
);
--> statement-breakpoint
CREATE TABLE "batch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"input" jsonb,
	"planned_revision" text,
	"request_id" uuid,
	"requested_revision" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "uq_batch_target" UNIQUE("run_id","media_id","kind"),
	CONSTRAINT "batch_item_kind" CHECK ("batch_items"."kind" IN ('metadata', 'thumbnail', 'tagging', 'ccip')),
	CONSTRAINT "batch_item_status" CHECK ("batch_items"."status" IN ('pending', 'scheduled', 'completed', 'failed', 'cancelled', 'superseded', 'blocked')),
	CONSTRAINT "batch_item_request" CHECK ("batch_items"."status" <> 'scheduled' OR ("batch_items"."request_id" IS NOT NULL AND "batch_items"."requested_revision" IS NOT NULL)),
	CONSTRAINT "batch_item_attempt" CHECK ("batch_items"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "batch_run_cutovers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"authority" text DEFAULT 'legacy' NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batch_authority" CHECK ("batch_run_cutovers"."authority" IN ('legacy', 'dedicated')),
	CONSTRAINT "batch_generation" CHECK ("batch_run_cutovers"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "batch_run_legacy_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"blocked_reason" text,
	"dispatch_complete" boolean DEFAULT false NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp,
	"cancel_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "batch_status" CHECK ("batch_runs"."status" IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'blocked')),
	CONSTRAINT "batch_input" CHECK ("batch_runs"."status" IN ('blocked', 'completed', 'failed', 'cancelled') OR "batch_runs"."input" IS NOT NULL),
	CONSTRAINT "batch_attempt" CHECK ("batch_runs"."attempt_count" >= 0 AND "batch_runs"."max_attempts" > 0),
	CONSTRAINT "batch_lease" CHECK (("batch_runs"."lease_token" IS NULL) = ("batch_runs"."lease_expires_at" IS NULL)),
	CONSTRAINT "batch_blocked" CHECK (("batch_runs"."status" = 'blocked') = ("batch_runs"."blocked_reason" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "media_processing_states" ADD COLUMN "independent_demand" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_item_attempts" ADD CONSTRAINT "batch_item_attempts_item_id_batch_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."batch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_run_id_batch_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."batch_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_run_legacy_snapshots" ADD CONSTRAINT "batch_run_legacy_snapshots_run_id_batch_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."batch_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_batch_attempt_request" ON "batch_item_attempts" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_batch_item_progress" ON "batch_items" USING btree ("run_id","status","id");--> statement-breakpoint
CREATE INDEX "idx_batch_item_request" ON "batch_items" USING btree ("request_id","kind","status");--> statement-breakpoint
CREATE INDEX "idx_batch_dispatch" ON "batch_runs" USING btree ("status","dispatch_complete","lease_expires_at");
--> statement-breakpoint
INSERT INTO batch_run_cutovers (id) VALUES ('79000000-0000-4000-8000-000000000001');
--> statement-breakpoint
-- Quiesce/drain old producers and observers before activation. The row lock also fences old snapshots.
CREATE FUNCTION guard_retired_batch_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE relevant boolean;
DECLARE retired text[] := ARRAY['processMedia','auto_tagging','extract_ccip_vector','bulk_tagging_parent','bulk_tagging_dispatch','batch_ccip_parent','batch_ccip_dispatch','thumbnail_generation_parent','generate_thumbnail'];
BEGIN
  IF TG_OP = 'INSERT' THEN relevant := NEW.type = ANY(retired);
  ELSIF TG_OP = 'DELETE' THEN relevant := OLD.type = ANY(retired);
  ELSE relevant := OLD.type = ANY(retired) OR NEW.type = ANY(retired);
  END IF;
  IF relevant THEN
    PERFORM id FROM batch_run_cutovers WHERE id = '79000000-0000-4000-8000-000000000001' AND authority = 'legacy' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Legacy batch/processing job writes are retired'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
--> statement-breakpoint
CREATE TRIGGER guard_retired_batch_jobs BEFORE INSERT OR UPDATE OR DELETE ON jobs FOR EACH ROW EXECUTE FUNCTION guard_retired_batch_jobs();
--> statement-breakpoint
-- Enforce demand at the DB boundary too: a rolling old scheduler cannot claim a cancelled batch-only request.
CREATE FUNCTION guard_batch_processing_demand() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'in_progress' AND NOT NEW.independent_demand
     AND (OLD.status <> 'in_progress' OR NEW.claim_token IS DISTINCT FROM OLD.claim_token)
     AND NOT EXISTS (
       SELECT 1 FROM batch_items bi JOIN batch_runs br ON br.id = bi.run_id
       WHERE bi.request_id = NEW.request_id AND bi.kind = NEW.task_kind
         AND bi.status = 'scheduled' AND br.status IN ('pending','in_progress')
     ) THEN
    RAISE EXCEPTION 'Batch processing demand is inactive';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER guard_batch_processing_demand BEFORE UPDATE ON media_processing_states FOR EACH ROW EXECUTE FUNCTION guard_batch_processing_demand();
--> statement-breakpoint
-- Persist item outcomes in the same transaction as the fenced processing result, including during rolling deployment.
CREATE FUNCTION record_batch_processing_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_request uuid;
DECLARE new_status text;
DECLARE failure text;
BEGIN
  IF TG_OP = 'DELETE' THEN old_request := OLD.request_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.request_id IS DISTINCT FROM NEW.request_id THEN old_request := OLD.request_id;
  END IF;
  IF old_request IS NOT NULL THEN
    UPDATE batch_items SET status = 'superseded', failure_code = 'input_changed', updated_at = timezone('UTC', clock_timestamp()), finished_at = timezone('UTC', clock_timestamp())
      WHERE request_id = old_request AND kind = OLD.task_kind AND status = 'scheduled';
    UPDATE batch_item_attempts SET status = 'superseded', failure_code = 'input_changed', finished_at = timezone('UTC', clock_timestamp())
      WHERE request_id = old_request AND status = 'scheduled';
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.status IN ('completed','failed') THEN
    new_status := NEW.status;
    failure := CASE WHEN NEW.status = 'failed' THEN 'processing_failed' ELSE NULL END;
    UPDATE batch_items SET status = new_status, failure_code = failure, updated_at = timezone('UTC', clock_timestamp()), finished_at = timezone('UTC', clock_timestamp())
      WHERE request_id = NEW.request_id AND kind = NEW.task_kind AND requested_revision = NEW.requested_revision AND status = 'scheduled';
    UPDATE batch_item_attempts SET status = new_status, failure_code = failure, finished_at = timezone('UTC', clock_timestamp())
      WHERE request_id = NEW.request_id AND requested_revision = NEW.requested_revision AND status = 'scheduled';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
--> statement-breakpoint
CREATE TRIGGER record_batch_processing_outcome AFTER INSERT OR UPDATE OR DELETE ON media_processing_states FOR EACH ROW EXECUTE FUNCTION record_batch_processing_outcome();

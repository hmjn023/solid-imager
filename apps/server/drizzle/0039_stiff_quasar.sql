-- Stop/drain legacy download producers and workers before applying and activating this migration.
CREATE TABLE "download_run_cutovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authority" text DEFAULT 'legacy' NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "download_cutover_singleton" CHECK ("download_run_cutovers"."id" = '78900000-0000-4000-8000-000000000001'::uuid),
	CONSTRAINT "download_cutover_authority" CHECK ("download_run_cutovers"."authority" IN ('legacy', 'dedicated')),
	CONSTRAINT "download_cutover_generation" CHECK ("download_run_cutovers"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "download_run_legacy_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "download_run_legacy_snapshots_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "download_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"source_path" text,
	"input" jsonb,
	"request_key" text NOT NULL,
	"import_request_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"canonical_id" uuid,
	"blocked_reason" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp,
	"next_run_at" timestamp DEFAULT now() NOT NULL,
	"checkpoint" jsonb,
	"result" jsonb,
	"error" text,
	"parent_id" uuid,
	"cancel_requested_at" timestamp,
	"cancelled_at" timestamp,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "download_runs_import_request_id_unique" UNIQUE("import_request_id"),
	CONSTRAINT "download_run_status" CHECK ("download_runs"."status" IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'blocked', 'superseded')),
	CONSTRAINT "download_run_input" CHECK ("download_runs"."status" NOT IN ('pending', 'in_progress') OR "download_runs"."input" IS NOT NULL),
	CONSTRAINT "download_run_attempt" CHECK ("download_runs"."attempt_count" >= 0 AND "download_runs"."max_attempts" > 0),
	CONSTRAINT "download_run_lease" CHECK (("download_runs"."status" = 'in_progress') = ("download_runs"."lease_token" IS NOT NULL AND "download_runs"."lease_expires_at" IS NOT NULL)),
	CONSTRAINT "download_run_alias" CHECK (("download_runs"."status" = 'superseded') = ("download_runs"."canonical_id" IS NOT NULL) AND ("download_runs"."canonical_id" IS NULL OR "download_runs"."canonical_id" <> "download_runs"."id")),
	CONSTRAINT "download_run_blocked" CHECK (("download_runs"."status" = 'blocked') = ("download_runs"."blocked_reason" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "download_run_legacy_snapshots" ADD CONSTRAINT "download_run_legacy_snapshots_run_id_download_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."download_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_runs" ADD CONSTRAINT "download_runs_source_id_media_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."media_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_runs" ADD CONSTRAINT "download_runs_canonical_id_download_runs_id_fk" FOREIGN KEY ("canonical_id") REFERENCES "public"."download_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_download_active_key" ON "download_runs" USING btree ("source_id","request_key") WHERE "download_runs"."status" IN ('pending', 'in_progress');--> statement-breakpoint
CREATE INDEX "idx_download_due" ON "download_runs" USING btree ("next_run_at","created_at","id") WHERE "download_runs"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_download_expired" ON "download_runs" USING btree ("lease_expires_at") WHERE "download_runs"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "idx_download_history" ON "download_runs" USING btree ("created_at","id");
--> statement-breakpoint
INSERT INTO download_run_cutovers (id) VALUES ('78900000-0000-4000-8000-000000000001');
--> statement-breakpoint
CREATE FUNCTION guard_retired_download_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE relevant boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN relevant := NEW.type = 'downloadImage';
  ELSIF TG_OP = 'DELETE' THEN relevant := OLD.type = 'downloadImage';
  ELSE relevant := OLD.type = 'downloadImage' OR NEW.type = 'downloadImage';
  END IF;
  IF relevant THEN
    -- A row lock fences even an old transaction snapshot; gate state cannot change during the write.
    PERFORM id FROM download_run_cutovers WHERE id = '78900000-0000-4000-8000-000000000001' AND authority = 'legacy' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Legacy downloadImage writes are retired'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
--> statement-breakpoint
CREATE TRIGGER guard_retired_download_jobs BEFORE INSERT OR UPDATE OR DELETE ON jobs FOR EACH ROW EXECUTE FUNCTION guard_retired_download_jobs();

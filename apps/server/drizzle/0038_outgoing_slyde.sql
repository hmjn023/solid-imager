-- Stop/drain legacy import writers and in-flight approvals before applying and activating this migration.
-- This creates the legacy epoch; the initial API cutover snapshots/reconciles requests atomically.
CREATE TABLE "import_request_cutovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authority" text DEFAULT 'legacy' NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "import_cutover_singleton" CHECK ("import_request_cutovers"."id" = '62100000-0000-4000-8000-000000000001'::uuid),
	CONSTRAINT "import_cutover_authority" CHECK ("import_request_cutovers"."authority" IN ('legacy', 'dedicated')),
	CONSTRAINT "import_cutover_generation" CHECK ("import_request_cutovers"."generation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "import_request_legacy_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "import_request_legacy_snapshots_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "import_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item" jsonb,
	"request_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"canonical_id" uuid,
	"blocked_reason" text,
	"target_source_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"cancelled_at" timestamp,
	CONSTRAINT "import_request_status" CHECK ("import_requests"."status" IN ('pending', 'approved', 'cancelled', 'blocked', 'superseded')),
	CONSTRAINT "import_request_item" CHECK ("import_requests"."status" NOT IN ('pending', 'approved') OR "import_requests"."item" IS NOT NULL),
	CONSTRAINT "import_request_blocked" CHECK (("import_requests"."status" = 'blocked') = ("import_requests"."blocked_reason" IS NOT NULL)),
	CONSTRAINT "import_request_alias" CHECK (("import_requests"."status" = 'superseded') = ("import_requests"."canonical_id" IS NOT NULL) AND ("import_requests"."canonical_id" IS NULL OR "import_requests"."canonical_id" <> "import_requests"."id")),
	CONSTRAINT "import_request_approval" CHECK ("import_requests"."status" <> 'approved' OR "import_requests"."approved_at" IS NOT NULL),
	CONSTRAINT "import_request_cancellation" CHECK ("import_requests"."status" <> 'cancelled' OR "import_requests"."cancelled_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "import_request_legacy_snapshots" ADD CONSTRAINT "import_request_legacy_snapshots_request_id_import_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."import_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_requests" ADD CONSTRAINT "import_requests_canonical_id_import_requests_id_fk" FOREIGN KEY ("canonical_id") REFERENCES "public"."import_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_requests" ADD CONSTRAINT "import_requests_target_source_id_media_sources_id_fk" FOREIGN KEY ("target_source_id") REFERENCES "public"."media_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_import_pending_key" ON "import_requests" USING btree ("request_key") WHERE "import_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_import_pending_created" ON "import_requests" USING btree ("created_at","id") WHERE "import_requests"."status" = 'pending';
--> statement-breakpoint
INSERT INTO "import_request_cutovers" ("id") VALUES ('62100000-0000-4000-8000-000000000001');
--> statement-breakpoint
CREATE FUNCTION guard_retired_import_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE relevant boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN relevant := NEW.type = 'import_request';
  ELSIF TG_OP = 'DELETE' THEN relevant := OLD.type = 'import_request';
  ELSE relevant := OLD.type = 'import_request' OR NEW.type = 'import_request';
  END IF;
  IF relevant AND NOT EXISTS (SELECT 1 FROM import_request_cutovers WHERE id = '62100000-0000-4000-8000-000000000001' AND authority = 'legacy') THEN
    RAISE EXCEPTION 'Legacy import_request writes are retired';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
--> statement-breakpoint
CREATE TRIGGER guard_retired_import_jobs BEFORE INSERT OR UPDATE OR DELETE ON "jobs" FOR EACH ROW EXECUTE FUNCTION guard_retired_import_jobs();

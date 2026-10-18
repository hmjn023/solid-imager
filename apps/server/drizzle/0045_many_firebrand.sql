CREATE TABLE "job_runtime_cutovers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"authority" text DEFAULT 'legacy' NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_runtime_authority" CHECK ("job_runtime_cutovers"."authority" IN ('legacy','retired')),
	CONSTRAINT "job_runtime_epoch" CHECK ("job_runtime_cutovers"."generation" >= 0)
);
--> statement-breakpoint
INSERT INTO job_runtime_cutovers(id) VALUES ('79200000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION legacy_job_family(kind text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN kind='import_request' THEN 'imports' WHEN kind='downloadImage' THEN 'downloads'
 WHEN kind IN ('processMedia','auto_tagging','extract_ccip_vector','bulk_tagging_parent','bulk_tagging_dispatch','batch_ccip_parent','batch_ccip_dispatch','thumbnail_generation_parent','generate_thumbnail') THEN 'batches'
 WHEN kind IN ('source_export','source_restore','sync_lancedb','sync_lancedb_full','sync_lancedb_delta') THEN 'sources'
 ELSE 'unknown:'||kind END
$$;
--> statement-breakpoint
CREATE FUNCTION fence_retired_generic_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE authority text;
BEGIN
 SELECT c.authority INTO authority FROM job_runtime_cutovers c WHERE id='79200000-0000-4000-8000-000000000001' FOR SHARE;
 IF authority IS DISTINCT FROM 'legacy' THEN RAISE EXCEPTION 'Generic jobs runtime is retired; release the final fence before flow rollback'; END IF;
 IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM jobs child WHERE child.parent_id=OLD.id AND legacy_job_family(child.type)<>legacy_job_family(OLD.type)) THEN
  RAISE EXCEPTION 'Classify cross-family legacy children before deleting or converting their parent';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER jobs_final_retirement_fence BEFORE INSERT OR UPDATE OR DELETE ON jobs FOR EACH ROW EXECUTE FUNCTION fence_retired_generic_jobs();

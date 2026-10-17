ALTER TABLE "source_sync_runs" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "source_transfer_runs" ADD COLUMN "started_at" timestamp;
--> statement-breakpoint
INSERT INTO source_run_cutovers(id) VALUES ('79100000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION guard_retired_source_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE authority text;
BEGIN
 IF (TG_OP <> 'INSERT' AND OLD.type IN ('source_export','source_restore','sync_lancedb','sync_lancedb_full','sync_lancedb_delta'))
 OR (TG_OP <> 'DELETE' AND NEW.type IN ('source_export','source_restore','sync_lancedb','sync_lancedb_full','sync_lancedb_delta')) THEN
  SELECT c.authority INTO authority FROM source_run_cutovers c WHERE id='79100000-0000-4000-8000-000000000001' FOR SHARE;
  IF authority IS DISTINCT FROM 'legacy' THEN RAISE EXCEPTION 'Legacy source writer is fenced'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER fence_retired_source_jobs BEFORE INSERT OR UPDATE OR DELETE ON jobs FOR EACH ROW EXECUTE FUNCTION guard_retired_source_jobs();
--> statement-breakpoint
CREATE FUNCTION mark_source_sync_dirty(source uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE active boolean;
BEGIN
 IF source IS NULL THEN RETURN; END IF;
 SELECT EXISTS(SELECT 1 FROM source_sync_runs WHERE source_id=source AND status IN ('pending','in_progress')) INTO active;
 INSERT INTO source_sync_watermarks(source_id,generation,requested_generation) VALUES(source,1,CASE WHEN active THEN 1 ELSE 0 END)
 ON CONFLICT(source_id) DO UPDATE SET generation=source_sync_watermarks.generation+1,
 requested_generation=CASE WHEN active THEN source_sync_watermarks.generation+1 ELSE source_sync_watermarks.requested_generation END;
END $$;
--> statement-breakpoint
CREATE FUNCTION dirty_source_sync_from_media() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.source_id,OLD.file_path,OLD.modified_at,OLD.file_size,OLD.media_type) IS NOT DISTINCT FROM (NEW.source_id,NEW.file_path,NEW.modified_at,NEW.file_size,NEW.media_type) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN PERFORM mark_source_sync_dirty(OLD.source_id); END IF;
 IF TG_OP<>'DELETE' AND (TG_OP='INSERT' OR OLD.source_id IS DISTINCT FROM NEW.source_id) THEN PERFORM mark_source_sync_dirty(NEW.source_id); END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER source_sync_media_dirty AFTER INSERT OR UPDATE OR DELETE ON media FOR EACH ROW EXECUTE FUNCTION dirty_source_sync_from_media();
--> statement-breakpoint
CREATE FUNCTION dirty_source_sync_from_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.type,OLD.connection_info) IS DISTINCT FROM (NEW.type,NEW.connection_info) THEN PERFORM mark_source_sync_dirty(NEW.id); END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER source_sync_config_dirty AFTER UPDATE ON media_sources FOR EACH ROW EXECUTE FUNCTION dirty_source_sync_from_source();

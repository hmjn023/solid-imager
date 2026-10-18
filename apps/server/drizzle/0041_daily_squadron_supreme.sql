CREATE TABLE "batch_run_dirty" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batch_run_dirty" ADD CONSTRAINT "batch_run_dirty_run_id_batch_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."batch_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION mark_batch_dirty_new() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO batch_run_dirty (run_id, generation)
    SELECT DISTINCT run_id, 1 FROM changed_batch_items ORDER BY run_id
    ON CONFLICT (run_id) DO UPDATE SET generation = batch_run_dirty.generation + 1;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION mark_batch_dirty_deleted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO batch_run_dirty (run_id, generation)
    SELECT DISTINCT old_items.run_id, 1 FROM changed_batch_items old_items JOIN batch_runs br ON br.id = old_items.run_id ORDER BY old_items.run_id
    ON CONFLICT (run_id) DO UPDATE SET generation = batch_run_dirty.generation + 1;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER mark_batch_dirty_insert AFTER INSERT ON batch_items REFERENCING NEW TABLE AS changed_batch_items FOR EACH STATEMENT EXECUTE FUNCTION mark_batch_dirty_new();
--> statement-breakpoint
CREATE TRIGGER mark_batch_dirty_update AFTER UPDATE ON batch_items REFERENCING NEW TABLE AS changed_batch_items FOR EACH STATEMENT EXECUTE FUNCTION mark_batch_dirty_new();
--> statement-breakpoint
CREATE TRIGGER mark_batch_dirty_delete AFTER DELETE ON batch_items REFERENCING OLD TABLE AS changed_batch_items FOR EACH STATEMENT EXECUTE FUNCTION mark_batch_dirty_deleted();
--> statement-breakpoint
CREATE VIEW batch_run_status AS
  SELECT br.id, br.created_at,
    CASE WHEN br.status IN ('pending','in_progress') AND br.dispatch_complete AND coalesce(p.pending,0) = 0
      THEN CASE WHEN coalesce(p.failed,0) > 0 THEN 'failed' ELSE 'completed' END
      ELSE br.status END AS status
  FROM batch_runs br
  LEFT JOIN (
    SELECT run_id,
      count(*) FILTER (WHERE status IN ('pending','scheduled')) AS pending,
      count(*) FILTER (WHERE status IN ('failed','superseded','blocked')) AS failed
    FROM batch_items GROUP BY run_id
  ) p ON p.run_id = br.id;

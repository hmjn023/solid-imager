CREATE TABLE "related_tag_frequencies" (
	"tag_id" uuid PRIMARY KEY NOT NULL,
	"image_count" bigint NOT NULL
);
--> statement-breakpoint
-- Keep the initial snapshot and trigger installation atomic with concurrent writers.
LOCK TABLE media, media_tags IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
INSERT INTO related_tag_frequencies (tag_id, image_count)
SELECT mt.tag_id, count(*)
FROM media_tags mt JOIN media m ON m.id = mt.media_id
WHERE m.status = 'active' AND m.media_type = 'image'
  AND mt.tag_type = 'positive' AND coalesce(mt.confidence, 1) > 0
GROUP BY mt.tag_id;
--> statement-breakpoint
-- Transition tables collapse bulk retagging into one delta per tag. Lock the
-- affected media before reading eligibility so a concurrent archive is counted once.
CREATE FUNCTION update_related_tag_frequencies() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  changes text;
BEGIN
  changes := CASE TG_OP
    WHEN 'INSERT' THEN 'SELECT *, 1 AS delta FROM new_tags'
    WHEN 'DELETE' THEN 'SELECT *, -1 AS delta FROM old_tags'
    ELSE 'SELECT *, -1 AS delta FROM old_tags UNION ALL SELECT *, 1 AS delta FROM new_tags'
  END;
  EXECUTE format('SELECT m.id FROM media m
    WHERE m.id IN (SELECT media_id FROM (%s) t)
    ORDER BY m.id FOR SHARE', changes);
  EXECUTE format('INSERT INTO related_tag_frequencies AS f (tag_id, image_count)
    SELECT t.tag_id, sum(t.delta)
    FROM (%s) t JOIN media m ON m.id = t.media_id
    WHERE m.status = ''active'' AND m.media_type = ''image''
      AND t.tag_type = ''positive'' AND coalesce(t.confidence, 1) > 0
    GROUP BY t.tag_id HAVING sum(t.delta) <> 0 ORDER BY t.tag_id
    ON CONFLICT (tag_id) DO UPDATE SET image_count = f.image_count + excluded.image_count', changes);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER related_tags_insert AFTER INSERT ON media_tags
REFERENCING NEW TABLE AS new_tags FOR EACH STATEMENT EXECUTE FUNCTION update_related_tag_frequencies();
--> statement-breakpoint
CREATE TRIGGER related_tags_delete AFTER DELETE ON media_tags
REFERENCING OLD TABLE AS old_tags FOR EACH STATEMENT EXECUTE FUNCTION update_related_tag_frequencies();
--> statement-breakpoint
CREATE TRIGGER related_tags_update AFTER UPDATE ON media_tags
REFERENCING OLD TABLE AS old_tags NEW TABLE AS new_tags FOR EACH STATEMENT EXECUTE FUNCTION update_related_tag_frequencies();
--> statement-breakpoint
-- Before a hard delete the associations still exist. Their subsequent cascaded
-- deletion sees no parent and contributes no second decrement.
CREATE FUNCTION change_related_media_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  delta integer;
BEGIN
  delta := CASE WHEN TG_OP = 'UPDATE' AND NEW.status = 'active' AND NEW.media_type = 'image' THEN 1 ELSE 0 END
         - CASE WHEN OLD.status = 'active' AND OLD.media_type = 'image' THEN 1 ELSE 0 END;
  IF delta <> 0 THEN
    INSERT INTO related_tag_frequencies AS f (tag_id, image_count)
    SELECT tag_id, delta FROM media_tags WHERE media_id = OLD.id
      AND tag_type = 'positive' AND coalesce(confidence, 1) > 0 ORDER BY tag_id
    ON CONFLICT (tag_id) DO UPDATE SET image_count = f.image_count + excluded.image_count;
  END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER related_media_update AFTER UPDATE OF status, media_type ON media
FOR EACH ROW EXECUTE FUNCTION change_related_media_eligibility();
--> statement-breakpoint
CREATE TRIGGER related_media_delete BEFORE DELETE ON media
FOR EACH ROW EXECUTE FUNCTION change_related_media_eligibility();
--> statement-breakpoint
CREATE FUNCTION truncate_related_tag_frequencies() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  TRUNCATE related_tag_frequencies;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER related_tags_truncate AFTER TRUNCATE ON media_tags
FOR EACH STATEMENT EXECUTE FUNCTION truncate_related_tag_frequencies();

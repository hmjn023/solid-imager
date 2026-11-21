DROP INDEX "idx_media_urls_url";--> statement-breakpoint

-- 重複するURLを削除（最新のcreated_atを持つレコードを残す）
DELETE FROM "media_urls" 
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT "id", 
           ROW_NUMBER() OVER (PARTITION BY "url" ORDER BY "created_at" DESC) as rn
    FROM "media_urls"
  ) t
  WHERE t.rn > 1
);--> statement-breakpoint

CREATE UNIQUE INDEX "idx_media_urls_url_unique" ON "media_urls" USING btree ("url");
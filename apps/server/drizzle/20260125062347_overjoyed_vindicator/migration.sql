DROP INDEX "idx_media_urls_url_unique";--> statement-breakpoint
CREATE INDEX "idx_media_urls_url" ON "media_urls" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_media_urls_media_id_url_unique" ON "media_urls" USING btree ("media_id","url");
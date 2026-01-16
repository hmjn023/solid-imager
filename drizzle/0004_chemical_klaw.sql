DROP INDEX "idx_media_urls_url";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_media_urls_url_unique" ON "media_urls" USING btree ("url");
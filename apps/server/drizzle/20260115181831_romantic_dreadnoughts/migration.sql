CREATE INDEX "idx_media_collections_media_id" ON "media_collections" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "idx_media_urls_url" ON "media_urls" USING btree ("url");
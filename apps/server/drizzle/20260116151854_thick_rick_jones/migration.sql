DROP INDEX IF EXISTS "idx_media_file_size";--> statement-breakpoint
CREATE INDEX "idx_media_file_size" ON "media" USING btree ("file_size");
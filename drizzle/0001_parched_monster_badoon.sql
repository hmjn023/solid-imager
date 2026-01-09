CREATE INDEX "idx_media_authors_author_id_media_id" ON "media_authors" USING btree ("author_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_media_characters_character_id_media_id" ON "media_characters" USING btree ("character_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_media_tags_tag_id_media_id" ON "media_tags" USING btree ("tag_id","media_id");
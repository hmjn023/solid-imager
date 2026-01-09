CREATE INDEX "idx_media_authors_author_id" ON "media_authors" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_media_characters_character_id" ON "media_characters" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_media_tags_tag_id" ON "media_tags" USING btree ("tag_id");
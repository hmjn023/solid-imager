DROP INDEX "idx_media_categories_category_id";--> statement-breakpoint
DROP INDEX "idx_media_ips_ip_id";--> statement-breakpoint
DROP INDEX "idx_media_projects_project_id";--> statement-breakpoint
CREATE INDEX "idx_authors_name" ON "authors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_characters_ip_id" ON "characters" USING btree ("ip_id");--> statement-breakpoint
CREATE INDEX "idx_media_authors_author_id_media_id" ON "media_authors" USING btree ("author_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_media_categories_category_id_media_id" ON "media_categories" USING btree ("category_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_media_characters_character_id_media_id" ON "media_characters" USING btree ("character_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_media_ips_ip_id_media_id" ON "media_ips" USING btree ("ip_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_media_projects_project_id_media_id" ON "media_projects" USING btree ("project_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_media_tags_tag_id_tag_type_media_id" ON "media_tags" USING btree ("tag_id","tag_type","media_id");--> statement-breakpoint
CREATE INDEX "idx_projects_name" ON "projects" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_tags_author_id" ON "tags" USING btree ("author_id");
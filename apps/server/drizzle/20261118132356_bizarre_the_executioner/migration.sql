CREATE TABLE "tag_name_redirects" (
	"name" text PRIMARY KEY NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tag_name_redirects" ADD CONSTRAINT "tag_name_redirects_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tag_name_redirects_tag_id" ON "tag_name_redirects" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_tag_dictionary_aliases" ON "tag_dictionary_tags" USING gin ("aliases");--> statement-breakpoint
ALTER TABLE "tag_dictionary_wiki" DROP COLUMN "search_text";
--> statement-breakpoint
UPDATE "tag_dictionary_tags" AS tag
SET "search_text" = (
	SELECT string_agg(btrim(regexp_replace(lower(normalize(term, NFKC)), '[[:space:]_]+', ' ', 'g')), E'\n' ORDER BY position)
	FROM jsonb_array_elements_text(jsonb_build_array(tag.name) || tag.aliases)
		WITH ORDINALITY AS terms(term, position)
);

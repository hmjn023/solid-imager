CREATE TABLE "uuidv7_migration_map" (
	"entity" text NOT NULL,
	"old_id" uuid NOT NULL,
	"new_id" uuid NOT NULL,
	"source_timestamp" timestamp,
	"migrated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uuidv7_migration_map_entity_old_id_pk" PRIMARY KEY("entity","old_id"),
	CONSTRAINT "uuidv7_migration_map_entity_new_id_unique" UNIQUE("entity","new_id")
);
--> statement-breakpoint
CREATE TEMP TABLE "_uuidv7_id_map" (
	"entity" text NOT NULL,
	"old_id" uuid NOT NULL,
	"new_id" uuid NOT NULL,
	PRIMARY KEY ("entity", "old_id"),
	UNIQUE ("entity", "new_id")
) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'media_sources', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM media_sources;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'media', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM media;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'media_regions', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM media_regions;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'ccip_embeddings', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM ccip_embeddings;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'tags', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM tags;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'categories', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM categories;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'projects', id,
	uuidv7(
		COALESCE(created_at, updated_at, transaction_timestamp() AT TIME ZONE 'UTC')
		- (transaction_timestamp() AT TIME ZONE 'UTC')
	),
	COALESCE(created_at, updated_at, transaction_timestamp() AT TIME ZONE 'UTC')
FROM projects;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'ips', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM ips;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'characters', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM characters;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'view_history', id,
	uuidv7(
		COALESCE(viewed_at, transaction_timestamp() AT TIME ZONE 'UTC')
		- (transaction_timestamp() AT TIME ZONE 'UTC')
	),
	COALESCE(viewed_at, transaction_timestamp() AT TIME ZONE 'UTC')
FROM view_history;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'similar_media', id,
	uuidv7(
		COALESCE(created_at, transaction_timestamp() AT TIME ZONE 'UTC')
		- (transaction_timestamp() AT TIME ZONE 'UTC')
	),
	COALESCE(created_at, transaction_timestamp() AT TIME ZONE 'UTC')
FROM similar_media;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'media_relations', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM media_relations;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'authors', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM authors;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'author_accounts', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM author_accounts;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'media_urls', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM media_urls;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'users', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM users;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'collections', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM collections;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'jobs', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM jobs;
--> statement-breakpoint
INSERT INTO "uuidv7_migration_map" ("entity", "old_id", "new_id", "source_timestamp")
SELECT 'search_snapshots', id,
	uuidv7(created_at - (transaction_timestamp() AT TIME ZONE 'UTC')),
	created_at
FROM search_snapshots;
--> statement-breakpoint
INSERT INTO "_uuidv7_id_map" ("entity", "old_id", "new_id")
SELECT "entity", "old_id", "new_id"
FROM "uuidv7_migration_map";
--> statement-breakpoint
DO $$
DECLARE
	foreign_key record;
BEGIN
	FOR foreign_key IN
		SELECT namespace.nspname AS schema_name, relation.relname AS table_name, constraint_row.conname
		FROM pg_constraint AS constraint_row
		JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
		JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
		WHERE constraint_row.contype = 'f'
			AND namespace.nspname = 'public'
	LOOP
		EXECUTE format(
			'ALTER TABLE %I.%I DROP CONSTRAINT %I',
			foreign_key.schema_name,
			foreign_key.table_name,
			foreign_key.conname
		);
	END LOOP;
END $$;
--> statement-breakpoint
UPDATE media_sources AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media_sources' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE media AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE media_regions AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media_regions' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE ccip_embeddings AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'ccip_embeddings' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE tags AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'tags' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE categories AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'categories' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE projects AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'projects' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE ips AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'ips' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE characters AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'characters' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE view_history AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'view_history' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE similar_media AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'similar_media' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE media_relations AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media_relations' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE authors AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'authors' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE author_accounts AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'author_accounts' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE media_urls AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media_urls' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE users AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'users' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE collections AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'collections' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE jobs AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'jobs' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE search_snapshots AS target
SET id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'search_snapshots' AND target.id = mapping.old_id;
--> statement-breakpoint
UPDATE categories AS target
SET parent_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'categories' AND target.parent_id = mapping.old_id;
--> statement-breakpoint
UPDATE collections AS target
SET user_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'users' AND target.user_id = mapping.old_id;
--> statement-breakpoint
UPDATE jobs AS target
SET source_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media_sources' AND target.source_id = mapping.old_id;
--> statement-breakpoint
UPDATE jobs AS target
SET parent_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'jobs' AND target.parent_id = mapping.old_id;
--> statement-breakpoint
UPDATE media AS target
SET source_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media_sources' AND target.source_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_regions AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE ccip_embeddings AS target
SET region_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media_regions' AND target.region_id = mapping.old_id;
--> statement-breakpoint
UPDATE character_ips AS target
SET character_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'characters' AND target.character_id = mapping.old_id;
--> statement-breakpoint
UPDATE character_ips AS target
SET ip_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'ips' AND target.ip_id = mapping.old_id;
--> statement-breakpoint
UPDATE author_accounts AS target
SET author_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'authors' AND target.author_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_authors AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_authors AS target
SET author_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'authors' AND target.author_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_categories AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_categories AS target
SET category_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'categories' AND target.category_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_characters AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_characters AS target
SET character_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'characters' AND target.character_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_collections AS target
SET collection_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'collections' AND target.collection_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_collections AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_details AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_generation_info AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_ips AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_ips AS target
SET ip_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'ips' AND target.ip_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_projects AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_projects AS target
SET project_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'projects' AND target.project_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_relations AS target
SET parent_media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.parent_media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_relations AS target
SET child_media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.child_media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_sync AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_tags AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_tags AS target
SET tag_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'tags' AND target.tag_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_technical_info AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
UPDATE media_urls AS target
SET media_id = mapping.new_id
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media' AND target.media_id = mapping.old_id;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pg_temp.uuidv7_map_text(p_entity text, p_value text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
	mapped_id uuid;
BEGIN
	IF p_value IS NULL OR p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
		RETURN p_value;
	END IF;

	SELECT new_id
	INTO mapped_id
	FROM "_uuidv7_id_map"
	WHERE entity = p_entity AND old_id = p_value::uuid;

	RETURN COALESCE(mapped_id::text, p_value);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pg_temp.uuidv7_entity_for_key(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT CASE lower(replace(COALESCE(p_key, ''), '_', ''))
		WHEN 'mediaid' THEN 'media'
		WHEN 'mediaids' THEN 'media'
		WHEN 'targetmediaid' THEN 'media'
		WHEN 'anchormediaid' THEN 'media'
		WHEN 'similarityanchormediaid' THEN 'media'
		WHEN 'parentmediaid' THEN 'media'
		WHEN 'childmediaid' THEN 'media'
		WHEN 'media1id' THEN 'media'
		WHEN 'media2id' THEN 'media'
		WHEN 'media' THEN 'media'
		WHEN 'mediasourceid' THEN 'media_sources'
		WHEN 'sourceid' THEN 'media_sources'
		WHEN 'selectedsource' THEN 'media_sources'
		WHEN 'targetsourceid' THEN 'media_sources'
		WHEN 'source' THEN 'media_sources'
		WHEN 'jobid' THEN 'jobs'
		WHEN 'jobids' THEN 'jobs'
		WHEN 'parentid' THEN 'jobs'
		WHEN 'authorid' THEN 'authors'
		WHEN 'authorids' THEN 'authors'
		WHEN 'author' THEN 'authors'
		WHEN 'authors' THEN 'authors'
		WHEN 'projectid' THEN 'projects'
		WHEN 'projectids' THEN 'projects'
		WHEN 'project' THEN 'projects'
		WHEN 'projects' THEN 'projects'
		WHEN 'ipid' THEN 'ips'
		WHEN 'ipids' THEN 'ips'
		WHEN 'ip' THEN 'ips'
		WHEN 'ips' THEN 'ips'
		WHEN 'characterid' THEN 'characters'
		WHEN 'characterids' THEN 'characters'
		WHEN 'character' THEN 'characters'
		WHEN 'characters' THEN 'characters'
		WHEN 'categoryid' THEN 'categories'
		WHEN 'categoryids' THEN 'categories'
		WHEN 'category' THEN 'categories'
		WHEN 'categories' THEN 'categories'
		WHEN 'tagid' THEN 'tags'
		WHEN 'tagids' THEN 'tags'
		WHEN 'tag' THEN 'tags'
		WHEN 'tags' THEN 'tags'
		WHEN 'collectionid' THEN 'collections'
		WHEN 'collectionids' THEN 'collections'
		WHEN 'collection' THEN 'collections'
		WHEN 'collections' THEN 'collections'
		WHEN 'userid' THEN 'users'
		WHEN 'userids' THEN 'users'
		ELSE NULL
	END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pg_temp.uuidv7_rewrite_jsonb(p_value jsonb, p_key text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
	item record;
	result jsonb;
	entity_name text;
	child_value jsonb;
	value_text text;
BEGIN
	IF p_value IS NULL THEN
		RETURN NULL;
	END IF;

	CASE jsonb_typeof(p_value)
		WHEN 'object' THEN
			result := '{}'::jsonb;
			FOR item IN SELECT key, value FROM jsonb_each(p_value)
			LOOP
				IF item.key = 'value' AND p_value->>'type' = 'criterion' THEN
					child_value := pg_temp.uuidv7_rewrite_jsonb(item.value, p_value->>'target');
				ELSE
					child_value := pg_temp.uuidv7_rewrite_jsonb(item.value, item.key);
				END IF;
				result := result || jsonb_build_object(item.key, child_value);
			END LOOP;
			RETURN result;
		WHEN 'array' THEN
			SELECT COALESCE(
				jsonb_agg(pg_temp.uuidv7_rewrite_jsonb(value, p_key) ORDER BY ordinal),
				'[]'::jsonb
			)
			INTO result
			FROM jsonb_array_elements(p_value) WITH ORDINALITY AS elements(value, ordinal);
			RETURN result;
		WHEN 'string' THEN
			entity_name := pg_temp.uuidv7_entity_for_key(p_key);
			IF entity_name IS NULL THEN
				RETURN p_value;
			END IF;
			value_text := p_value #>> '{}';
			RETURN to_jsonb(pg_temp.uuidv7_map_text(entity_name, value_text));
		ELSE
			RETURN p_value;
	END CASE;
END;
$$;
--> statement-breakpoint
UPDATE jobs
SET payload = pg_temp.uuidv7_rewrite_jsonb(payload)
WHERE payload IS NOT NULL;
--> statement-breakpoint
UPDATE jobs
SET result = pg_temp.uuidv7_rewrite_jsonb(result)
WHERE result IS NOT NULL;
--> statement-breakpoint
UPDATE search_snapshots
SET state = pg_temp.uuidv7_rewrite_jsonb(state)
WHERE state IS NOT NULL;
--> statement-breakpoint
UPDATE presets
SET value = pg_temp.uuidv7_rewrite_jsonb(value)
WHERE value IS NOT NULL;
--> statement-breakpoint
UPDATE jobs AS target
SET artifact_path = replace(target.artifact_path, mapping.old_id::text, mapping.new_id::text)
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'jobs'
	AND target.id = mapping.new_id
	AND target.artifact_path IS NOT NULL
	AND target.artifact_path LIKE '%' || mapping.old_id::text || '%';
--> statement-breakpoint
UPDATE jobs AS target
SET payload = jsonb_set(
	target.payload,
	'{inputPath}',
	to_jsonb(replace(target.payload->>'inputPath', mapping.old_id::text, mapping.new_id::text)),
	true
)
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'jobs'
	AND target.id = mapping.new_id
	AND target.payload ? 'inputPath'
	AND target.payload->>'inputPath' LIKE '%' || mapping.old_id::text || '%';
--> statement-breakpoint
UPDATE jobs AS target
SET artifact_file_name = replace(target.artifact_file_name, mapping.old_id::text, mapping.new_id::text)
FROM "_uuidv7_id_map" AS mapping
WHERE mapping.entity = 'media_sources'
	AND target.artifact_file_name IS NOT NULL
	AND target.artifact_file_name LIKE '%' || mapping.old_id::text || '%';
--> statement-breakpoint
ALTER TABLE categories
	ADD CONSTRAINT categories_parent_id_categories_id_fk
	FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE collections
	ADD CONSTRAINT collections_user_id_users_id_fk
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE jobs
	ADD CONSTRAINT jobs_source_id_media_sources_id_fk
	FOREIGN KEY (source_id) REFERENCES media_sources(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE jobs
	ADD CONSTRAINT jobs_parent_id_jobs_id_fk
	FOREIGN KEY (parent_id) REFERENCES jobs(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_authors
	ADD CONSTRAINT media_authors_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_authors
	ADD CONSTRAINT media_authors_author_id_authors_id_fk
	FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_categories
	ADD CONSTRAINT media_categories_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_categories
	ADD CONSTRAINT media_categories_category_id_categories_id_fk
	FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_characters
	ADD CONSTRAINT media_characters_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_characters
	ADD CONSTRAINT media_characters_character_id_characters_id_fk
	FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_collections
	ADD CONSTRAINT media_collections_collection_id_collections_id_fk
	FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_collections
	ADD CONSTRAINT media_collections_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_details
	ADD CONSTRAINT media_details_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_generation_info
	ADD CONSTRAINT media_generation_info_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_ips
	ADD CONSTRAINT media_ips_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_ips
	ADD CONSTRAINT media_ips_ip_id_ips_id_fk
	FOREIGN KEY (ip_id) REFERENCES ips(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_projects
	ADD CONSTRAINT media_projects_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_projects
	ADD CONSTRAINT media_projects_project_id_projects_id_fk
	FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_relations
	ADD CONSTRAINT media_relations_parent_media_id_media_id_fk
	FOREIGN KEY (parent_media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_relations
	ADD CONSTRAINT media_relations_child_media_id_media_id_fk
	FOREIGN KEY (child_media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_sync
	ADD CONSTRAINT media_sync_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_tags
	ADD CONSTRAINT media_tags_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_tags
	ADD CONSTRAINT media_tags_tag_id_tags_id_fk
	FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_technical_info
	ADD CONSTRAINT media_technical_info_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_urls
	ADD CONSTRAINT media_urls_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media
	ADD CONSTRAINT media_source_id_media_sources_id_fk
	FOREIGN KEY (source_id) REFERENCES media_sources(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE similar_media
	ADD CONSTRAINT similar_media_media1_id_media_id_fk
	FOREIGN KEY (media1_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE similar_media
	ADD CONSTRAINT similar_media_media2_id_media_id_fk
	FOREIGN KEY (media2_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE tags
	ADD CONSTRAINT tags_author_id_authors_id_fk
	FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE view_history
	ADD CONSTRAINT view_history_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE character_ips
	ADD CONSTRAINT character_ips_character_id_characters_id_fk
	FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE character_ips
	ADD CONSTRAINT character_ips_ip_id_ips_id_fk
	FOREIGN KEY (ip_id) REFERENCES ips(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE author_accounts
	ADD CONSTRAINT author_accounts_author_id_authors_id_fk
	FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE ccip_embeddings
	ADD CONSTRAINT ccip_embeddings_region_id_media_regions_id_fk
	FOREIGN KEY (region_id) REFERENCES media_regions(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE media_regions
	ADD CONSTRAINT media_regions_media_id_media_id_fk
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE ON UPDATE NO ACTION;

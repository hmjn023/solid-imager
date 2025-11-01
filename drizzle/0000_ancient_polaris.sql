CREATE TYPE "public"."job_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_organization_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."media_relation_type" AS ENUM('variant', 'version', 'page', 'derivative', 'edit', 'source');--> statement-breakpoint
CREATE TYPE "public"."media_source_type" AS ENUM('local', 'sftp', 's3');--> statement-breakpoint
CREATE TYPE "public"."media_sync_status" AS ENUM('synced', 'pending', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'audio');--> statement-breakpoint
CREATE TYPE "public"."tag_type" AS ENUM('positive', 'negative');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"color" text DEFAULT '#808080',
	"parent_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ip_id" integer,
	"description" text DEFAULT '',
	"source" text DEFAULT 'manual' NOT NULL,
	"aliases" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "name_ipId_unique" UNIQUE("name","ip_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ips" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ips_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"source_id" uuid,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_categories" (
	"media_id" uuid NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "media_categories_media_id_category_id_pk" PRIMARY KEY("media_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "media_characters" (
	"media_id" uuid NOT NULL,
	"character_id" integer NOT NULL,
	"confidence" real,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "media_characters_media_id_character_id_pk" PRIMARY KEY("media_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "media_collections" (
	"collection_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"display_order" integer,
	CONSTRAINT "media_collections_collection_id_media_id_pk" PRIMARY KEY("collection_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "media_details" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"rating" integer DEFAULT 0,
	"favorite" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"last_viewed_at" timestamp DEFAULT '1970-01-01 00:00:00'
);
--> statement-breakpoint
CREATE TABLE "media_generation_info" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"prompt" text,
	"negative_prompt" text,
	"workflow" jsonb,
	"loras" jsonb,
	"vae" text,
	"hypernetworks" jsonb,
	"embeddings" jsonb,
	"ai_generated" boolean DEFAULT false,
	"model_name" text DEFAULT '',
	"seed" bigint DEFAULT -1,
	"cfg_scale" real DEFAULT 0,
	"steps" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "media_ips" (
	"media_id" uuid NOT NULL,
	"ip_id" integer NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "media_ips_media_id_ip_id_pk" PRIMARY KEY("media_id","ip_id")
);
--> statement-breakpoint
CREATE TABLE "media_projects" (
	"media_id" uuid NOT NULL,
	"project_id" integer NOT NULL,
	CONSTRAINT "media_projects_media_id_project_id_pk" PRIMARY KEY("media_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "media_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_media_id" uuid NOT NULL,
	"child_media_id" uuid NOT NULL,
	"relation_type" "media_relation_type" NOT NULL,
	"order_index" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parent_child_type_unique" UNIQUE("parent_media_id","child_media_id","relation_type")
);
--> statement-breakpoint
CREATE TABLE "media_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "media_source_type" NOT NULL,
	"connection_info" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_sync" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"sync_status" "media_sync_status" DEFAULT 'synced',
	"backup_urls" text[] DEFAULT '{}',
	"last_synced_at" timestamp,
	"sync_attempts" integer DEFAULT 0,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"media_id" uuid NOT NULL,
	"tag_id" integer NOT NULL,
	"tag_type" "tag_type" DEFAULT 'positive' NOT NULL,
	"confidence" real,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "media_tags_media_id_tag_id_tag_type_pk" PRIMARY KEY("media_id","tag_id","tag_type")
);
--> statement-breakpoint
CREATE TABLE "media_technical_info" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"color_profile" text DEFAULT '',
	"exif_data" jsonb DEFAULT '{}',
	"hash_md5" text DEFAULT '',
	"hash_perceptual" text DEFAULT '',
	"duration_seconds" real,
	"frame_rate" real,
	"bitrate_kbps" integer,
	"video_codec" text,
	"audio_codec" text
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"media_type" "media_type" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"file_size" bigint,
	"description" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"modified_at" timestamp DEFAULT now() NOT NULL,
	"indexed_at" timestamp DEFAULT now() NOT NULL,
	"status" "media_organization_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "source_id_file_path_unique" UNIQUE("source_id","file_path")
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "presets_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "similar_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"media1_id" uuid NOT NULL,
	"media2_id" uuid NOT NULL,
	"similarity_score" real DEFAULT 0,
	"algorithm" text DEFAULT 'perceptual',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "media1Id_media2Id_algorithm_unique" UNIQUE("media1_id","media2_id","algorithm")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"attribute" text,
	"color" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "view_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_id" uuid NOT NULL,
	"viewed_at" timestamp DEFAULT now(),
	"ip_address" text,
	"user_agent" text DEFAULT ''
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_ip_id_ips_id_fk" FOREIGN KEY ("ip_id") REFERENCES "public"."ips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_media_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."media_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_categories" ADD CONSTRAINT "media_categories_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_categories" ADD CONSTRAINT "media_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_characters" ADD CONSTRAINT "media_characters_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_characters" ADD CONSTRAINT "media_characters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_collections" ADD CONSTRAINT "media_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_collections" ADD CONSTRAINT "media_collections_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_details" ADD CONSTRAINT "media_details_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_generation_info" ADD CONSTRAINT "media_generation_info_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_ips" ADD CONSTRAINT "media_ips_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_ips" ADD CONSTRAINT "media_ips_ip_id_ips_id_fk" FOREIGN KEY ("ip_id") REFERENCES "public"."ips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_projects" ADD CONSTRAINT "media_projects_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_projects" ADD CONSTRAINT "media_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relations" ADD CONSTRAINT "media_relations_parent_media_id_media_id_fk" FOREIGN KEY ("parent_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relations" ADD CONSTRAINT "media_relations_child_media_id_media_id_fk" FOREIGN KEY ("child_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_sync" ADD CONSTRAINT "media_sync_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_technical_info" ADD CONSTRAINT "media_technical_info_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_source_id_media_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."media_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_media" ADD CONSTRAINT "similar_media_media1_id_media_id_fk" FOREIGN KEY ("media1_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_media" ADD CONSTRAINT "similar_media_media2_id_media_id_fk" FOREIGN KEY ("media2_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_history" ADD CONSTRAINT "view_history_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_categories_category_id" ON "media_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_media_details_rating" ON "media_details" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_media_details_favorite" ON "media_details" USING btree ("favorite");--> statement-breakpoint
CREATE INDEX "idx_media_details_view_count" ON "media_details" USING btree ("view_count");--> statement-breakpoint
CREATE INDEX "idx_media_generation_info_metadata" ON "media_generation_info" USING btree ("metadata");--> statement-breakpoint
CREATE INDEX "idx_media_generation_info_ai_generated" ON "media_generation_info" USING btree ("ai_generated");--> statement-breakpoint
CREATE INDEX "idx_media_generation_info_model_name" ON "media_generation_info" USING btree ("model_name");--> statement-breakpoint
CREATE INDEX "idx_media_ips_ip_id" ON "media_ips" USING btree ("ip_id");--> statement-breakpoint
CREATE INDEX "idx_media_projects_project_id" ON "media_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_media_relations_parent" ON "media_relations" USING btree ("parent_media_id");--> statement-breakpoint
CREATE INDEX "idx_media_relations_child" ON "media_relations" USING btree ("child_media_id");--> statement-breakpoint
CREATE INDEX "idx_media_relations_type" ON "media_relations" USING btree ("relation_type");--> statement-breakpoint
CREATE INDEX "idx_media_technical_info_hash_md5" ON "media_technical_info" USING btree ("hash_md5");--> statement-breakpoint
CREATE INDEX "idx_media_source_id" ON "media" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_media_file_name" ON "media" USING btree ("file_name");--> statement-breakpoint
CREATE INDEX "idx_media_created_at" ON "media" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_media_description" ON "media" USING btree ("description");--> statement-breakpoint
CREATE INDEX "idx_similar_media_score" ON "similar_media" USING btree ("similarity_score");--> statement-breakpoint
CREATE INDEX "idx_tags_name" ON "tags" USING btree ("name");
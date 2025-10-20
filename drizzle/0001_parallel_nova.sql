CREATE TYPE "public"."media_relation_type" AS ENUM('variant', 'version', 'page', 'derivative', 'edit', 'source');--> statement-breakpoint
CREATE TABLE "media_categories" (
	"media_id" uuid NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "media_categories_media_id_category_id_pk" PRIMARY KEY("media_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "media_collections" (
	"collection_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"display_order" integer,
	CONSTRAINT "media_collections_collection_id_media_id_pk" PRIMARY KEY("collection_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "media_ips" (
	"media_id" uuid NOT NULL,
	"ip_id" integer NOT NULL,
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
ALTER TABLE "collection_media" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_organization" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "collection_media" CASCADE;--> statement-breakpoint
DROP TABLE "media_organization" CASCADE;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "description" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "ips" ALTER COLUMN "description" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "description" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ips" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "ips" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ips" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "media_characters" ADD COLUMN "confidence" real;--> statement-breakpoint
ALTER TABLE "media_tags" ADD COLUMN "confidence" real;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "status" "media_organization_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "media_categories" ADD CONSTRAINT "media_categories_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_categories" ADD CONSTRAINT "media_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_collections" ADD CONSTRAINT "media_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_collections" ADD CONSTRAINT "media_collections_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_ips" ADD CONSTRAINT "media_ips_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_ips" ADD CONSTRAINT "media_ips_ip_id_ips_id_fk" FOREIGN KEY ("ip_id") REFERENCES "public"."ips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_projects" ADD CONSTRAINT "media_projects_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_projects" ADD CONSTRAINT "media_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relations" ADD CONSTRAINT "media_relations_parent_media_id_media_id_fk" FOREIGN KEY ("parent_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relations" ADD CONSTRAINT "media_relations_child_media_id_media_id_fk" FOREIGN KEY ("child_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_categories_category_id" ON "media_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_media_ips_ip_id" ON "media_ips" USING btree ("ip_id");--> statement-breakpoint
CREATE INDEX "idx_media_projects_project_id" ON "media_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_media_relations_parent" ON "media_relations" USING btree ("parent_media_id");--> statement-breakpoint
CREATE INDEX "idx_media_relations_child" ON "media_relations" USING btree ("child_media_id");--> statement-breakpoint
CREATE INDEX "idx_media_relations_type" ON "media_relations" USING btree ("relation_type");
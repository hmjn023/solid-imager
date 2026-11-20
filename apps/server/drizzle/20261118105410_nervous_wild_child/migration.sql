CREATE TABLE "tag_dictionary_attributes" (
	"name" text PRIMARY KEY NOT NULL,
	"attributes" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_dictionary_snapshots" (
	"source" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"count" integer NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_dictionary_tags" (
	"name" text PRIMARY KEY NOT NULL,
	"category" integer NOT NULL,
	"post_count" integer NOT NULL,
	"japanese" text,
	"aliases" jsonb NOT NULL,
	"search_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_dictionary_wiki" (
	"name" text PRIMARY KEY NOT NULL,
	"body" text,
	"other_names" jsonb NOT NULL,
	"search_text" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_tag_dictionary_popular" ON "tag_dictionary_tags" USING btree ("post_count" DESC NULLS LAST,"name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_active_tag_dictionary_refresh" ON "jobs" USING btree ("type") WHERE "jobs"."type" = 'tag_dictionary_refresh' AND "jobs"."status" IN ('pending', 'in_progress');
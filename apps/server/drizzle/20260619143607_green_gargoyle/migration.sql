CREATE TABLE "lancedb_sync_dirty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"operation" text DEFAULT 'upsert' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lancedb_sync_dirty_source_media_unique" UNIQUE("source_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "lancedb_sync_dirty" ADD CONSTRAINT "lancedb_sync_dirty_source_id_media_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."media_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lancedb_sync_dirty_source_updated" ON "lancedb_sync_dirty" USING btree ("source_id","updated_at");
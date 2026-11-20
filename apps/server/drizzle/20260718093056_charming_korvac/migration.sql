CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."media_region_kind" AS ENUM('full', 'person', 'manual');--> statement-breakpoint
CREATE TABLE "ccip_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_id" uuid NOT NULL,
	"embedding" vector(768) NOT NULL,
	"model" text NOT NULL,
	"embedding_version" integer NOT NULL,
	"media_modified_at" timestamp NOT NULL,
	"extracted_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ccip_embeddings_region_model_version" UNIQUE("region_id","model","embedding_version")
);
--> statement-breakpoint
CREATE TABLE "media_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"kind" "media_region_kind" NOT NULL,
	"x" real,
	"y" real,
	"width" real,
	"height" real,
	"source_modified_at" timestamp NOT NULL,
	"detector" text,
	"detector_version" text,
	"score" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_regions_bbox_by_kind" CHECK ((
				("media_regions"."kind" = 'full' AND "media_regions"."x" IS NULL AND "media_regions"."y" IS NULL AND "media_regions"."width" IS NULL AND "media_regions"."height" IS NULL)
				OR
				("media_regions"."kind" <> 'full' AND "media_regions"."x" IS NOT NULL AND "media_regions"."y" IS NOT NULL AND "media_regions"."width" IS NOT NULL AND "media_regions"."height" IS NOT NULL
					AND "media_regions"."x" >= 0 AND "media_regions"."y" >= 0 AND "media_regions"."width" > 0 AND "media_regions"."height" > 0
					AND "media_regions"."x" + "media_regions"."width" <= 1 AND "media_regions"."y" + "media_regions"."height" <= 1)
			)),
	CONSTRAINT "media_regions_score_range" CHECK ("media_regions"."score" IS NULL OR ("media_regions"."score" >= 0 AND "media_regions"."score" <= 1))
);
--> statement-breakpoint
ALTER TABLE "ccip_embeddings" ADD CONSTRAINT "ccip_embeddings_region_id_media_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."media_regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_regions" ADD CONSTRAINT "media_regions_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ccip_embeddings_region_id" ON "ccip_embeddings" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "idx_media_regions_media_id" ON "media_regions" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_media_regions_full_media_id" ON "media_regions" USING btree ("media_id") WHERE "media_regions"."kind" = 'full';

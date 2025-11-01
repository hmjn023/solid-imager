CREATE TYPE "public"."tag_type" AS ENUM('positive', 'negative');--> statement-breakpoint
ALTER TABLE "media_tags" DROP CONSTRAINT "media_tags_media_id_tag_id_pk";--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_media_id_tag_id_tag_type_pk" PRIMARY KEY("media_id","tag_id","tag_type");--> statement-breakpoint
ALTER TABLE "media_tags" ADD COLUMN "tag_type" "tag_type" DEFAULT 'positive' NOT NULL;
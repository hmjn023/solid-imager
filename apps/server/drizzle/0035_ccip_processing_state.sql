ALTER TABLE "media_processing_states" DROP CONSTRAINT "media_processing_kind";--> statement-breakpoint
ALTER TABLE "ccip_embeddings" ADD COLUMN "processing_revision" text;--> statement-breakpoint
ALTER TABLE "media_processing_states" ADD CONSTRAINT "media_processing_kind" CHECK ("media_processing_states"."task_kind" IN ('metadata', 'thumbnail', 'tagging', 'ccip'));
ALTER TABLE "characters" ADD COLUMN "aliases" jsonb;--> statement-breakpoint
ALTER TABLE "media_generation_info" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "media_generation_info" ADD COLUMN "negative_prompt" text;--> statement-breakpoint
ALTER TABLE "media_generation_info" ADD COLUMN "workflow" jsonb;--> statement-breakpoint
ALTER TABLE "media_generation_info" ADD COLUMN "loras" jsonb;--> statement-breakpoint
ALTER TABLE "media_generation_info" ADD COLUMN "vae" text;--> statement-breakpoint
ALTER TABLE "media_generation_info" ADD COLUMN "hypernetworks" jsonb;--> statement-breakpoint
ALTER TABLE "media_generation_info" ADD COLUMN "embeddings" jsonb;--> statement-breakpoint
ALTER TABLE "media_sync" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "media_sync" ADD COLUMN "sync_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "media_sync" ADD COLUMN "last_error" text;
ALTER TABLE "media_characters" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_ips" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_tags" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;
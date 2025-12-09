CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"account_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_authors" (
	"media_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "media_authors_media_id_author_id_pk" PRIMARY KEY("media_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "media_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "media_authors" ADD CONSTRAINT "media_authors_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_authors" ADD CONSTRAINT "media_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_urls" ADD CONSTRAINT "media_urls_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_authors_account_id" ON "authors" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_media_urls_media_id" ON "media_urls" USING btree ("media_id");--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "media_urls" ("media_id", "url") SELECT "id", "source_url" FROM "media" WHERE "source_url" IS NOT NULL AND "source_url" != '';--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "source_url";
CREATE TYPE "public"."author_platform" AS ENUM('twitter', 'pixiv-fanbox', 'danbooru');--> statement-breakpoint
CREATE TABLE "author_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"platform" "author_platform" NOT NULL,
	"account_id" text NOT NULL,
	"profile_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "author_accounts" ADD CONSTRAINT "author_accounts_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_author_accounts_author_id" ON "author_accounts" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_author_accounts_platform_account_unique" ON "author_accounts" USING btree ("platform","account_id");--> statement-breakpoint
INSERT INTO "author_accounts" ("author_id", "platform", "account_id")
SELECT DISTINCT ON ("account_id")
	"id",
	'twitter'::"author_platform",
	"account_id"
FROM "authors"
WHERE "account_id" IS NOT NULL AND "account_id" <> ''
ORDER BY "account_id", "created_at", "id";

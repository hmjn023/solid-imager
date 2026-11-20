DROP INDEX "idx_author_accounts_platform_account_unique";--> statement-breakpoint
DROP INDEX "idx_authors_account_id";--> statement-breakpoint
ALTER TABLE "author_accounts" ALTER COLUMN "platform" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "author_accounts" ADD COLUMN "remote_id" text;--> statement-breakpoint
ALTER TABLE "author_accounts" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "author_accounts" ADD COLUMN "observed_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_author_accounts_remote_identity" ON "author_accounts" USING btree ("platform","remote_id") WHERE "author_accounts"."remote_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_author_accounts_unresolved_identity" ON "author_accounts" USING btree ("platform","account_id") WHERE "author_accounts"."remote_id" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_author_accounts_handle" ON "author_accounts" USING btree ("platform","account_id");--> statement-breakpoint
-- Preserve unscoped legacy identifiers without guessing their platform or identity.
INSERT INTO "author_accounts" ("id", "author_id", "platform", "account_id", "display_name", "created_at", "updated_at")
SELECT gen_random_uuid(), a."id", NULL, a."account_id", a."name", a."created_at", a."updated_at"
FROM "authors" a
WHERE a."account_id" IS NOT NULL AND length(trim(a."account_id")) > 0
AND NOT EXISTS (SELECT 1 FROM "author_accounts" ac WHERE ac."author_id" = a."id" AND ac."account_id" = a."account_id");
--> statement-breakpoint
UPDATE "author_accounts" ac SET "display_name" = a."name" FROM "authors" a WHERE ac."author_id" = a."id" AND ac."display_name" IS NULL;
--> statement-breakpoint
ALTER TABLE "authors" DROP COLUMN "account_id";
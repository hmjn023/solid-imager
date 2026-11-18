CREATE TABLE "character_ips" (
	"character_id" uuid NOT NULL,
	"ip_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "character_ips_character_id_ip_id_pk" PRIMARY KEY("character_id","ip_id")
);
--> statement-breakpoint

-- MIGRATION LOGIC START --

-- 1. Copy existing relationships to the new table
INSERT INTO "character_ips" ("character_id", "ip_id", "source")
SELECT "id", "ip_id", "source"
FROM "characters"
WHERE "ip_id" IS NOT NULL;
--> statement-breakpoint

-- 2. Handle duplicates (Same name, different IPs)
DO $$
DECLARE
    r RECORD;
    survivor_id UUID;
BEGIN
    FOR r IN SELECT "name" FROM "characters" GROUP BY "name" HAVING count(*) > 1 LOOP
        -- Pick the oldest one as survivor
        SELECT "id" INTO survivor_id FROM "characters" WHERE "name" = r.name ORDER BY "created_at" ASC LIMIT 1;

        -- Update character_ips: Copy IPs from duplicates to survivor
        INSERT INTO "character_ips" ("character_id", "ip_id", "source")
        SELECT survivor_id, "ip_id", "source"
        FROM "character_ips"
        WHERE "character_id" IN (SELECT "id" FROM "characters" WHERE "name" = r.name AND "id" != survivor_id)
        ON CONFLICT ("character_id", "ip_id") DO NOTHING;

        -- Delete relations for duplicates in character_ips
        DELETE FROM "character_ips"
        WHERE "character_id" IN (SELECT "id" FROM "characters" WHERE "name" = r.name AND "id" != survivor_id);

        -- Update media_characters: Move media associations to survivor
        INSERT INTO "media_characters" ("media_id", "character_id", "confidence", "source")
        SELECT "media_id", survivor_id, "confidence", "source"
        FROM "media_characters"
        WHERE "character_id" IN (SELECT "id" FROM "characters" WHERE "name" = r.name AND "id" != survivor_id)
        ON CONFLICT ("media_id", "character_id") DO NOTHING;

        -- Delete old media relations
        DELETE FROM "media_characters"
        WHERE "character_id" IN (SELECT "id" FROM "characters" WHERE "name" = r.name AND "id" != survivor_id);

        -- Delete duplicate characters
        DELETE FROM "characters"
        WHERE "name" = r.name AND "id" != survivor_id;

    END LOOP;
END $$;
--> statement-breakpoint

-- MIGRATION LOGIC END --

ALTER TABLE "characters" DROP CONSTRAINT "name_ipId_unique";--> statement-breakpoint
ALTER TABLE "characters" DROP CONSTRAINT "characters_ip_id_ips_id_fk";
--> statement-breakpoint
DROP INDEX "idx_characters_ip_id";--> statement-breakpoint
ALTER TABLE "character_ips" ADD CONSTRAINT "character_ips_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_ips" ADD CONSTRAINT "character_ips_ip_id_ips_id_fk" FOREIGN KEY ("ip_id") REFERENCES "public"."ips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_character_ips_ip_id_character_id" ON "character_ips" USING btree ("ip_id","character_id");--> statement-breakpoint
ALTER TABLE "characters" DROP COLUMN "ip_id";--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_name_unique" UNIQUE("name");

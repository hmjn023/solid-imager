CREATE TABLE "search_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"fingerprint" text NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_snapshots_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE INDEX "idx_search_snapshots_created_at" ON "search_snapshots" USING btree ("created_at");
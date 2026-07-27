ALTER TYPE "public"."job_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "ccip_embeddings" ADD COLUMN "input_revision" text;--> statement-breakpoint
ALTER TABLE "ccip_embeddings" ADD COLUMN "preprocessing_profile" text DEFAULT 'dghs-imgutils-rs/full-image-default/v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "ccip_embeddings" DROP CONSTRAINT "uq_ccip_embeddings_region_model_version";--> statement-breakpoint
ALTER TABLE "ccip_embeddings" ADD CONSTRAINT "uq_ccip_embeddings_region_model_version" UNIQUE("region_id","model","embedding_version","preprocessing_profile");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_ccip_embeddings_embedding_cosine";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "queue_name" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "input_revision" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "concurrency_key" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "available_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "max_attempts" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "lease_duration_ms" integer DEFAULT 300000 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "claim_token" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "claimed_by" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "heartbeat_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "lancedb_sync_dirty" ADD COLUMN "generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_regions" ADD COLUMN "source_width" integer;--> statement-breakpoint
ALTER TABLE "media_regions" ADD COLUMN "source_height" integer;--> statement-breakpoint
ALTER TABLE "media_regions" ADD COLUMN "source_revision" text;--> statement-breakpoint
ALTER TABLE "media_regions" ADD COLUMN "region_revision" text;--> statement-breakpoint
ALTER TABLE "media_regions" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "media_regions" ADD COLUMN "manual_reason" text;--> statement-breakpoint
ALTER TABLE "media_regions" ADD COLUMN "detection_key" text;--> statement-breakpoint
ALTER TABLE "media_regions" ADD COLUMN "detector_model" text;--> statement-breakpoint
ALTER TABLE "media_relations" ADD COLUMN "source_region_id" uuid;--> statement-breakpoint
ALTER TABLE "media_relations" ADD COLUMN "derivation_key" text;--> statement-breakpoint
UPDATE "jobs"
SET
	"queue_name" = CASE
		WHEN "type" IN ('auto_tagging', 'extract_ccip_vector') THEN 'ai'
		ELSE 'default'
	END,
	"available_at" = "created_at";--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "media_regions" AS region
		INNER JOIN "media" AS media ON media."id" = region."media_id"
		WHERE media."width" <= 0 OR media."height" <= 0
	) THEN
		RAISE EXCEPTION 'Cannot migrate media_regions: source media dimensions must be positive';
	END IF;
END
$$;--> statement-breakpoint
UPDATE "media_regions" AS region
SET
	"source_width" = media."width",
	"source_height" = media."height",
	"source_revision" = encode(
		sha256(
			convert_to(
				concat(
					'{"version":1,"mediaId":', to_json(media."id"::text)::text,
					',"mediaSourceId":', to_json(media."source_id"::text)::text,
					',"modifiedAtMs":', floor(extract(epoch FROM region."source_modified_at") * 1000)::bigint,
					',"fileSize":', coalesce(media."file_size"::text, 'null'),
					',"width":', media."width",
					',"height":', media."height", '}'
				),
				'UTF8'
			)
		),
		'hex'
	)
FROM "media" AS media
WHERE media."id" = region."media_id";--> statement-breakpoint
UPDATE "media_regions"
SET "region_revision" = encode(
	sha256(
		convert_to(
			concat(
				'{"version":1,"sourceRevision":', to_json("source_revision")::text,
				',"kind":', to_json("kind"::text)::text,
				',"x":', coalesce(to_json("x")::text, 'null'),
				',"y":', coalesce(to_json("y")::text, 'null'),
				',"width":', coalesce(to_json("width")::text, 'null'),
				',"height":', coalesce(to_json("height")::text, 'null'),
				',"label":', coalesce(to_json("label")::text, 'null'),
				',"detector":', coalesce(to_json("detector")::text, 'null'),
				',"detectorModel":', coalesce(to_json("detector_model")::text, 'null'),
				',"detectorVersion":', coalesce(to_json("detector_version")::text, 'null'),
				',"manualReason":', coalesce(to_json("manual_reason")::text, 'null'), '}'
			),
			'UTF8'
		)
	),
	'hex'
);--> statement-breakpoint
WITH embedding_sources AS (
	SELECT
		embedding."id",
		embedding."model",
		embedding."embedding_version",
		embedding."preprocessing_profile",
		encode(
			sha256(
				convert_to(
					concat(
						'{"version":1,"mediaId":', to_json(media."id"::text)::text,
						',"mediaSourceId":', to_json(media."source_id"::text)::text,
						',"modifiedAtMs":', floor(extract(epoch FROM embedding."media_modified_at") * 1000)::bigint,
						',"fileSize":', coalesce(media."file_size"::text, 'null'),
						',"width":', media."width",
						',"height":', media."height", '}'
					),
					'UTF8'
				)
			),
			'hex'
		) AS source_revision
	FROM "ccip_embeddings" AS embedding
	INNER JOIN "media_regions" AS region ON region."id" = embedding."region_id"
	INNER JOIN "media" AS media ON media."id" = region."media_id"
)
UPDATE "ccip_embeddings" AS embedding
SET "input_revision" = encode(
	sha256(
		convert_to(
			concat(
				'{"version":1,"sourceRevision":', to_json(source."source_revision")::text,
				',"model":', to_json(source."model")::text,
				',"embeddingVersion":', source."embedding_version",
				',"preprocessingProfile":', to_json(source."preprocessing_profile")::text, '}'
			),
			'UTF8'
		)
	),
	'hex'
)
FROM embedding_sources AS source
WHERE source."id" = embedding."id";--> statement-breakpoint
ALTER TABLE "media_regions" ALTER COLUMN "source_width" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_regions" ALTER COLUMN "source_height" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_regions" ALTER COLUMN "source_revision" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_regions" ALTER COLUMN "region_revision" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ccip_embeddings" ALTER COLUMN "input_revision" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_relations" ADD CONSTRAINT "media_relations_source_region_id_media_regions_id_fk" FOREIGN KEY ("source_region_id") REFERENCES "public"."media_regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_jobs_claim" ON "jobs" USING btree ("queue_name","available_at","created_at","id") WHERE "jobs"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_jobs_stale_lease" ON "jobs" USING btree ("heartbeat_at","claimed_at") WHERE "jobs"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "idx_jobs_parent_status" ON "jobs" USING btree ("parent_id","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_status_updated" ON "jobs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_active_dedupe" ON "jobs" USING btree ("dedupe_key") WHERE "jobs"."dedupe_key" IS NOT NULL AND "jobs"."status" IN ('pending', 'in_progress');--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_running_concurrency" ON "jobs" USING btree ("concurrency_key") WHERE "jobs"."concurrency_key" IS NOT NULL AND "jobs"."status" = 'in_progress';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_media_regions_detection_key" ON "media_regions" USING btree ("media_id","detection_key") WHERE "media_regions"."detection_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_media_relations_source_region" ON "media_relations" USING btree ("source_region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_media_relations_derivation_key" ON "media_relations" USING btree ("derivation_key") WHERE "media_relations"."derivation_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_attempt_count_nonnegative" CHECK ("jobs"."attempt_count" >= 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_max_attempts_positive" CHECK ("jobs"."max_attempts" > 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lease_duration_positive" CHECK ("jobs"."lease_duration_ms" > 0);--> statement-breakpoint
ALTER TABLE "media_regions" ADD CONSTRAINT "media_regions_source_dimensions_positive" CHECK ("media_regions"."source_width" > 0 AND "media_regions"."source_height" > 0);

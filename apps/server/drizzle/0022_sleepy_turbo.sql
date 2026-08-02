DO $$
BEGIN
	DELETE FROM "jobs" AS duplicate
	USING "jobs" AS retained
	WHERE duplicate."type" = 'generate_thumbnail'
		AND duplicate."status" = 'pending'
		AND retained."type" = duplicate."type"
		AND retained."status" IN ('pending', 'in_progress')
		AND retained."source_id" = duplicate."source_id"
		AND retained."payload"->>'mediaId' = duplicate."payload"->>'mediaId'
		AND retained."payload"->>'size' = duplicate."payload"->>'size'
		AND (
			retained."status" = 'in_progress'
			OR (retained."created_at", retained."id") < (duplicate."created_at", duplicate."id")
		);

	CREATE UNIQUE INDEX "uq_jobs_active_thumbnail" ON "jobs" USING btree ("source_id",("payload"->>'mediaId'),("payload"->>'size')) WHERE "jobs"."type" = 'generate_thumbnail'
					AND "jobs"."status" IN ('pending', 'in_progress')
					AND "jobs"."source_id" IS NOT NULL;
END $$;

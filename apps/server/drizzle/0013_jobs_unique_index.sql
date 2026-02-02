CREATE UNIQUE INDEX IF NOT EXISTS "jobs_type_media_id_pending_unique_idx" ON "jobs" ("type", (payload->>'mediaId')) WHERE status = 'pending';

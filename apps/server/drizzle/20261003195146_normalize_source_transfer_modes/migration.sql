-- Keep queued and retryable transfer jobs valid after the format names change.
UPDATE "jobs"
SET "payload" = jsonb_set(
  "payload",
  '{mode}',
  to_jsonb(CASE "payload"->>'mode' WHEN 'json' THEN 'ndjson' ELSE 'tar' END)
)
WHERE "type" IN ('source_export', 'source_restore')
  AND "payload"->>'mode' IN ('json', 'zip');

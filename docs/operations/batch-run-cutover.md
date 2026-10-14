# Batch run cutover (#790)

Batch runs own fixed targets and durable outcomes. Tagging, CCIP, metadata and thumbnails still execute only through `media_processing_states`. The batch dispatcher uses the existing general worker budget and never runs inference.

`batches.start/list/get/items/attempts/cancel/retry` expose safe projections. Jobs remains a compatibility view of dedicated runs and individual items. Old job IDs resolve through private snapshots. SSE is an invalidation signal; reconnect and reload restore state from the database.

## Activation

1. Stop and drain all old app instances, producers, observers and media schedulers. Back up the database and transfer files. Do not activate alongside old directory/restore writers.
2. Apply migrations 0040 and 0041. These only add dedicated tables, request ownership and fencing triggers; they do not drop jobs.
3. Inspect with `bun scripts/batch-run-cutover.ts inspect` from `apps/server`, using the intended database environment.
4. Activate with `bun scripts/batch-run-cutover.ts activate --writers-stopped`. Startup also performs the initial conversion after downloads have been converted.
5. Inspect again. The conversion archives every old row, compares complete JSON snapshots and counts, removes exactly the nine retired batch/processing types and changes authority in one transaction. Any failure rolls the transaction back.
6. Classify every blocked run before treating migration as complete. Incomplete dispatch scopes, ambiguous targets and missing request identities are blocked. The migration never guesses old targets from today's media.

Targets are captured with repeatable-read, keyset pages of at most 100 and a single settings snapshot. Dispatch binds at most 25 items per fenced transaction. Cancel stops unclaimed batch-only demand, retains independent/shared requests and preserves already completed history. Resume keeps fixed membership and success outcomes; changed inputs require a new batch.

Processing results and item attempt outcomes commit together through the database trigger. A durable generation marker drives notifications. Parent counts derive from fixed items, independently of the media's newer requests.

## Rollback rehearsal

Stop all new writers and drain native/file tasks. If final generic retirement (0045) is active, first release that fence using [jobs-runtime-retirement.md](./jobs-runtime-retirement.md); then run `bun scripts/batch-run-cutover.ts rollback --writers-stopped`.

Live dispatch leases or processing leases linked to batch items refuse rollback. Old IDs and private unknown fields are restored; successful targets remain terminal. Native runs reconstruct fixed legacy parents/children. ID collisions abort the whole transaction. Cancelled or paused batch-only pending work becomes failed before ordinary demand ownership is restored, preventing old schedulers from silently reviving it.

Rollback increments the epoch. Re-activation is deliberately refused until the restored data has been reviewed; restarting the new server does not silently switch authority back. Keep migrations and private archives throughout the rollback period.

## Validation and remaining gate

Use isolated PostgreSQL with `BATCH_TEST_POSTGRES_PORT` for independent-connection claims and repeatable-read old-writer fencing. Local integration tests use an owned temporary PGlite database. Browser tests exercise thumbnail-only fixed batches, source SSE reconnect, retained draft/focus, F5 and failed-item recovery in both dev and fresh production.

Real production observation, zero generic jobs reads/writes across every family, and a dated rollback deadline belong to #792. Neither this change nor passing tests is evidence that those operational gates have passed. Do not create or apply DROP TABLE jobs until that evidence exists.

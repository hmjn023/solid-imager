# Batch run cutover (#790)

Batch runs own fixed targets and durable outcomes. Tagging, CCIP, metadata and thumbnails still execute only through `media_processing_states`. The batch dispatcher uses the existing general worker budget and never runs inference.

Only local inference admission failures preserve the attempt budget and defer work for five seconds. Remote HTTP 429 responses use the normal bounded retry policy. Disconnecting an HTTP observer stops its result polling and releases its HTTP admission slot, while the durable media request and other observers continue independently.

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

Dispatch reconciles its own dirty marker between committed pages: after the first page, at roughly one-second intervals, and after the final page. The polling reconciler skips locked parent rows, so relying on polling alone delays progress throughout large dispatches. Keep aggregation outside reservation transactions and retain the time bound to avoid scanning all fixed items for every fast page.

Dispatch locks every existing media row in its bounded page, in ID order, before reserving requests or updating items. Processing failure settlement follows the same media-before-state order as successful commits. Parent lease/progress updates use `FOR NO KEY UPDATE` so the dirty-marker trigger's foreign-key `KEY SHARE` check can finish while dispatch owns the parent. Keep these orders when changing dispatch, cancellation or reconciliation.

After deploying a fix for a stopped dispatcher or exhausted processing attempts, resume the failed batch with its existing Retry action. This keeps fixed targets and completed outcomes; remaining pending items and failed items are dispatched again. A server restart alone does not resume a terminal failed batch.

In Jobs, select Failed, then select the batch parent and Retry job. Status filters apply across the combined history before pagination, so a parent behind newer pending children remains discoverable. Active includes pending and in-progress records; page counts reflect the selected status.

For a large failure backlog, use Failed → Retry all failed. This spans every page and retries batches once per parent, including failed children of an active batch and pending items stranded by a failed dispatcher. Completed, cancelled and blocked items remain unchanged. Downloads and recoverable source operations are retried as well; expired source inputs and retired/blocked operations are excluded. The progress count represents parent operations, not individual images.

`jobs.retryFailed` handles at most five execution owners per call and returns an opaque continuation cursor. Continue until `cursor` is null. Keyset pagination keeps shrinking result sets from skipping parents and advances past individual failures. The UI reports committed progress if a later call fails; rerunning the action skips work already queued. Leaving the screen stops additional calls after the current bounded request. This reserves existing durable work without creating another inference queue.

Jobs supports selected Retry, Cancel and Delete history actions. Capability flags determine eligibility; cancellation is sequential to avoid competing large batch writes. Delete history requires a terminal execution owner and dismisses a batch parent with all its children, even when invoked on a child. Migration 0046 adds `job_history_dismissals`; it changes visibility only and retains media, outcomes, checkpoints and source artifact retention cleanup. Dismissals are excluded before list pagination/counts and from retry-all. An explicit retry restores visibility. Cancelling a batch keeps completed siblings and independent/shared media demand.

Manager can submit tagging, CCIP and thumbnail batches and export/restore operations; Sources can submit sync operations. Jobs → Media processing also detects and queues unfinished metadata, thumbnails, tagging and CCIP work, including inputs without any request history. See [processing-recovery.md](./processing-recovery.md) for scope and continuation behavior. Downloads are submitted through imports/URL input and can be retried from Jobs while their source/input remain available.

## Rollback rehearsal

Stop all new writers and drain native/file tasks. If final generic retirement (0045) is active, first release that fence using [jobs-runtime-retirement.md](./jobs-runtime-retirement.md); then run `bun scripts/batch-run-cutover.ts rollback --writers-stopped`.

Live dispatch leases or processing leases linked to batch items refuse rollback. Old IDs and private unknown fields are restored; successful targets remain terminal. Native runs reconstruct fixed legacy parents/children. ID collisions abort the whole transaction. Cancelled or paused batch-only pending work becomes failed before ordinary demand ownership is restored, preventing old schedulers from silently reviving it.

Rollback increments the epoch. Re-activation is deliberately refused until the restored data has been reviewed; restarting the new server does not silently switch authority back. Keep migrations and private archives throughout the rollback period.

## Validation and remaining gate

Use isolated PostgreSQL with `BATCH_TEST_POSTGRES_PORT` for independent-connection claims and repeatable-read old-writer fencing. Local integration tests use an owned temporary PGlite database. Browser tests exercise thumbnail-only fixed batches, source SSE reconnect, retained draft/focus, F5 and failed-item recovery in both dev and fresh production.

Real production observation, zero generic jobs reads/writes across every family, and a dated rollback deadline belong to #792. Neither this change nor passing tests is evidence that those operational gates have passed. Do not create or apply DROP TABLE jobs until that evidence exists.

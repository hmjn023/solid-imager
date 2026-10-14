# Source operation cutover (#791)

Directory scans use `source_sync_runs` and transactional `source_sync_watermarks`. Source export and restore use `source_transfer_runs`. A single `source_run_leases` owner serializes all three operations for one source across processes. Existing general capacity is shared with downloads and batch dispatch; export has one independent slot. No source worker owns inference.

The Jobs API projects dedicated runs. `sourceRuns.list/get/cancel/retry` expose safe state, progress and artifact metadata. Source list/get derive sync status from durable runs. SSE remains an invalidation signal; reload and reconnect restore state from the database.

## Activate

1. Stop and drain old app instances, source producers and native/file workers. Back up the database and transfer storage together. Concurrent old/new source writers are unsupported.
2. Apply additive migrations 0042–0044. They retain jobs and add source authority fencing, shared leases and transactional dirty generations.
3. From `apps/server`, run `bun scripts/source-run-cutover.ts inspect` with the intended database environment. Classify unknown legacy types before proceeding.
4. Run `bun scripts/source-run-cutover.ts activate --writers-stopped`. Startup also performs the initial conversion after download and batch conversion.
5. Inspect counts and blocked reasons. Conversion archives every old row including unknown JSON fields, compares complete snapshots and counts, removes exactly the five retired source types, and changes authority in one transaction. Failure rolls all of this back. Old-version writes are fenced, including repeatable-read transactions started before activation.

Legacy export can restart read-only generation with a fresh attempt. Legacy restore has no trustworthy committed cursor; active/pending restore is archived and blocked as `legacy_restore_uncheckpointed`. Do not infer a cursor or replay it automatically. Review the source, then submit a new owned input if necessary. Legacy LanceDB synchronization has no current producer/handler and is archived as retired; it is never turned into directory synchronization. PostgreSQL dump-cache policy remains #638.

Directory scans stream the filesystem and keyset DB pages of 100. Deletion starts only after the complete traversal succeeds. Every mutation checks the current DB owner and source configuration. File identity changes and requests arriving during a scan advance a durable generation; completion advances only the generation it claimed. Failed scans stay terminal until explicit retry or a newer request.

Restore inputs are owned files with SHA-256 and byte length frozen at enqueue. NDJSON records are bounded to 8 MiB and committed in chunks of at most 100 records or approximately 4 MiB, with the byte cursor in the same DB transaction as metadata and processing requests. Retry retains committed progress. TAR permits only safe regular files/directories, validates the whole listing before extraction, copies images serially, and saves an archive-order cursor. Image publication is idempotent: a crash between filesystem rename and DB commit can replay the same immutable bytes. Metadata cursor advancement remains atomic with DB output. A changed source/input is blocked.

Exports use attempt-specific partial and final filenames. A current lease and matching source revision are required to rename and publish artifact metadata. Abort propagates to stream generation. Cancellation and lost ownership prevent stale attempts from publishing a visible artifact.

Inputs remain available for 24 hours after creation/progress/completion; artifacts for 24 hours after completion. Cleanup checks DB ownership and retention under the same source lock. Failed/cancelled inputs are retained for retry until expiry. Old attempt files for known terminal runs are reclaimed after 24 hours. Unknown files, which may belong to another database sharing storage, require operator review. Keep storage separate per runtime/database.

## Rollback rehearsal

Stop all new source writers and drain their leases, then run `bun scripts/source-run-cutover.ts rollback --writers-stopped`.

Rollback refuses live source owners. A partially applied native restore must complete or be explicitly cancelled before rollback; old code cannot resume its cursor. Legacy snapshots preserve IDs and unknown fields. Completed history stays terminal. Native transfer runs reconstruct equivalent legacy transfer rows. Native directory scans keep their dedicated history; old startup performs a full filesystem rescan, since there was no legacy directory job producer.

Rollback increments the authority epoch and cancels pending dedicated execution. New code refuses automatic reactivation after rollback. Keep the schema, private archives, owned inputs and artifacts through the rollback period. Restore the matching database/storage backup if the operator needs an earlier point in time.

## Evidence and final deletion gate

Use isolated PGlite for DB/filesystem restart, checkpoint, cancel/retry and retention coverage. Use an owned PostgreSQL fixture (`BATCH_TEST_POSTGRES_PORT`) for competing connections and repeatable-read fencing. Tests must cap memory, disable swap and avoid actual AI inference.

Production observation and a dated rollback deadline remain #792 prerequisites. Passing tests is not operational evidence. Do not create or apply DROP TABLE jobs before the reference audit, observation period and rollback deadline are satisfied.

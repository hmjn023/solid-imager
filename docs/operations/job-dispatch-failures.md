# Job dispatch failure handling

`packages/core/src/domain/jobs/dispatch.ts` defines executable job types and their payloads as one discriminated union. Server dispatch validates before invoking a handler, switches exhaustively on that union, and passes the original job to preserve stored internal processing request identities. Batch parent rows and approval requests are not executable tasks and are explicitly excluded from pending lookup and claim, even when legacy rows have pending status. Unknown types fail with `Unsupported job type`; invalid payloads fail with `Invalid job payload`. Detailed validation causes remain in server logs. These failures are terminal and are not automatically requeued as stale running jobs.

`markAsFailed` updates only the current in-progress attempt with no cancellation request. A single SQL statement also marks a recognized batch parent failed, with a safe message and finish time. If parent persistence fails, the child update rolls back. An old attempt or repeated failure cannot mutate the parent. Parent cancellation is preserved. A failed child can correct a prematurely completed parent, and late child/dispatch completion cannot return a failed or cancelled batch to completed. An explicit parent reset is required before completion is allowed again.

Already reserved media processing requests remain durable and continue independently. A batch failure does not cancel required metadata, thumbnails, tagging or CCIP requests. Failed dispatch may have committed some chunks before the failure; this change neither deletes those chunks nor fabricates an exact failed item count. Exact batch target history, cancellation and restart boundaries belong to #621 run/items. This is a bounded #619 change, not completion of all dedupe, lease/backoff, attempt fencing or batch migration requirements.

Worker outcome notifications use the existing job event bus after persistence. Failed batch state is re-read before sending its hint. Event publication failures are logged and do not turn committed completion into failure. DB state remains authoritative.

No schema migration or live data reconciliation is required for this code change. Existing pending unknown types will become failed when claimed, rather than silently completed. Existing completed legacy rows are not retrospectively changed. Before manually retrying invalid rows, fix the producer or payload; retrying the same unsupported input fails again.

The job retry API also rejects batch parents and approval requests without moving them to pending. Retry a failed processing step or dispatch job; complete batch restart semantics remain part of #621.

Verification:

```bash
bun run check
bun run test
bun run --cwd apps/server test:integration -- src/tests/integration/media/job-failure-reconciliation.test.ts
JOB_FAILURE_TEST_POSTGRES_PORT=<isolated-localhost-port> bun run --cwd apps/server test:integration -- src/tests/integration/media/job-failure-reconciliation.test.ts
```

The integration suite uses a temporary PGlite or a dedicated PostgreSQL 18 + pgvector database (`job_failure_test`, user `job_test`, password `ephemeral_job_test`, maximum 8 connections). It checks all three parent types, rejected stale/repeated attempts, cancellation, late completion, explicit reset, rollback on parent failure and competing child failure/completion with two independent PostgreSQL connections. Never point this test at a user database. Unit tests cover dispatch validation, internal request preservation, worker outcome events and notification failures; existing tests retain pool/concurrency behavior.

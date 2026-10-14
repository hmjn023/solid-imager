# Generic jobs runtime retirement (#792)

Normal producers, workers, processing status queries, Jobs API and artifact lookup now use dedicated import requests, download runs, batch runs/items and source runs. `JobWorker` only coordinates download/batch/source capacity; file and AI schedulers remain the sole owners of computation. General capacity is shared fairly, with one independent export slot. Download publication still saves the source URL and reserves metadata, thumbnails and AI tasks transactionally. This change does not introduce another execution path.

The public Jobs contract and job/source SSE names remain compatibility projections of dedicated state. They do not read `jobs`. Clients recover from reload/reconnect through the database APIs. The legacy dispatch, generic worker handlers, old processing observers, generic cleanup and server JobRepository wiring have been removed.

## Activation and audit

Use the intended database environment from `apps/server`. The maintenance scripts connect directly to the database and do not bootstrap workers.

1. Stop and drain every old/new application writer, media scheduler and source producer. Rolling old/new writers are unsupported. Verify a restorable database backup **and** matching owned transfer storage backup; preserve private snapshots and native run history.
2. Apply additive migrations through **0045**. This adds the final authority row and a write fence, without dropping `jobs` or changing its data. The fence also refuses deleting a parent with a child in another legacy family.
3. Run `bun scripts/jobs-retirement.ts inspect`. The output includes all database type/status groups, known/unknown classification, active count, broken/nonterminal-parent links, cross-family links, archive counts and missing archive targets. It contains no payloads. Compare it with [the 16-type matrix](./jobs-migration-matrix.md).
4. Resolve every unknown type, broken parent, cross-family link or missing archive before conversion. Startup preflight refuses these cases before any family cutover, preventing cascade loss. Preserve a backup and original private history when classifying; never delete or detach children merely to bypass the gate. A blocked preflight is an operator migration decision, not completed migration evidence.
5. Follow the existing [download](./download-run-cutover.md), [import](./import-request-cutover.md), [batch](./batch-run-cutover.md) and [source](./source-run-cutover.md) activation procedures. Initial startup runs download then import then batch then source conversion; download-first preserves import-origin reconciliation. Each family must have dedicated authority and a successful private snapshot/shadow comparison.
6. Run `bun scripts/jobs-retirement.ts activate --writers-stopped`, or start this server after the four conversions. Activation locks the old table before authority rows, requires all four dedicated authorities, **zero total legacy rows**, no broken links and no orphaned archives, then switches final authority to `retired`. Unknown rows are never treated as completed or silently discarded. All old INSERT/UPDATE/DELETE statements are fenced, including repeatable-read writers that started earlier.
7. Run the inspection once more and save its output. Close that connection before establishing the observation baseline. Start only the dedicated runtime. A normal restart with retired authority reads only the authority metadata; it does not scan `jobs`.

Per-family rollback/re-activation epochs remain independent. After rollback the new runtime refuses implicit reactivation; review restored data explicitly. A failed activation leaves the retained schema and history available for diagnosis.

## Dated production evidence

Tests are not production observation. No production baseline or elapsed rollback period is claimed by this PR.

After the last inspection connection has closed and its statistics have been flushed, record an owned evidence file:

```sh
bun scripts/jobs-retirement.ts begin-observation \
  --evidence /owned/operations/jobs-observation.json \
  --backup-reference verified-backup-ticket-or-location \
  --statistics-reset-audited --days 7 --rollback-days 14
bun scripts/jobs-retirement.ts sample --evidence /owned/operations/jobs-observation.json
```

Defaults are seven observation days and fourteen rollback days from the real database baseline time. Sample periodically, after representative bulk imports, retries/cancellations, source operations and dedicated-server restarts. The evidence records database/table identity, server start time, database statistics-reset time, baseline/last counters, actual deadlines and persistent violations. Reads are measured by sequential/index scan counters; writes by insert/update/delete counters. Sampling only reads catalog statistics, never the old table. A fresh file is required for a new observation; existing evidence is not silently overwritten. Concurrent samples use an exclusive sidecar lock and atomic replacement.

Every counter must remain unchanged and **both** deadlines must pass. Restart, database/table replacement, statistics reset, time reversal, counter regression or any observed activity invalidates the window. Dedicated restart is supported, but a PostgreSQL restart deliberately requires a new baseline. Keep failed evidence for review and establish a new baseline only after resolving the cause.

PostgreSQL cumulative counters alone cannot prove the absence of an intervening table-specific reset that was followed by activity. The DBA must audit/restrict statistics-reset operations (including `pg_stat_reset_single_table_counters` and `pg_clear_relation_stats`), DDL, restore and privileged maintenance for the whole interval. `--statistics-reset-audited` requires acknowledging that prerequisite; it does not implement a privileged-operation audit. Check backup restore viability separately. PostgreSQL statistics are asynchronous; close former writers/inspection sessions and allow their statistics to flush before recording a baseline. See [monitoring statistics](https://www.postgresql.org/docs/18/monitoring-stats.html) and [administrative functions](https://www.postgresql.org/docs/18/functions-admin.html).

`counterWindowPassed` reports only the counter/deadline condition. It does not authorize schema deletion. Record actual observation start/end, rollback expiry, reset/DDL audit reference, representative workload results and verified backup reference in #792 before considering the final deletion gate passed.

## Rollback

Stop all dedicated writers and drain all source/download/batch/media leases. Run:

```sh
bun scripts/jobs-retirement.ts rollback --writers-stopped
```

The command checks live owners and releases only the final generic write fence. It increments the epoch so this server cannot silently reactivate on restart. Then follow each family runbook, restoring referenced parent IDs before children when private history links require it. Review the archived parent graph rather than assuming one universal rollback order. Restore the matching database/storage backup if exact pre-cutover reconstruction is required. Keep the old runtime stopped until all selected family authorities and restored data agree. There is no supported mixed old/new writer deployment.

## Remaining maintenance references and final deletion

The following references intentionally remain through the rollback period:

- `packages/db/src/schema.ts`, additive migration history and the private DB legacy repository used by rollback/migration tests.
- Per-family cutover/backfill/rollback code and private snapshots; ordinary dedicated operations take the dedicated-authority fast path.
- `job-retirement-repository.ts` inspection/activation/rollback plus its catalog-only observation sampler.
- Legacy domain schemas required to validate archived data, and isolated migration/fencing tests.

The runtime-isolation unit test prevents normal server/application code from reintroducing generic repository or SQL access, and checks the type matrix against the classification. Integration tests cover unknown types, cross-family cascade protection, empty-audit activation, rollback drain, restart fast paths and PostgreSQL old-writer fencing. Actual production counters remain necessary because static checks cannot discover external scripts or old deployments.

Only after real observation, privileged-operation audit, verified backups and rollback expiry may a separate final PR remove these maintenance/schema references and add `DROP TABLE jobs`. **0045 contains no DROP and #792/#621 remain operationally open until those gates are recorded.** #638 dump caching is separate work.

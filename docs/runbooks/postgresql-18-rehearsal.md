# PostgreSQL 18 isolated rehearsal

This runbook validates a PostgreSQL 17 to 18 dump/restore without changing the
default `compose.yml`, its `db` service, or `db-data/`. The rehearsal uses the
dedicated `db-pg18-rehearsal` service and the named
`solid-imager-pg18-rehearsal-data` volume mounted at PostgreSQL 18's
`/var/lib/postgresql` parent directory.

## Safety boundary

- Do not point the rehearsal compose file at `db-data/` or any production bind
  mount.
- Do not run `docker compose down -v`; removing any volume requires separate,
  explicit approval.
- Restore refuses a target containing user tables, enums, domains, functions,
  sequences, views, or a Drizzle schema. A failed/partial target must be
  discarded and recreated as an isolated rehearsal target before retrying.
- The final default-image/volume cutover is not part of this rehearsal and must
  be approved as a separate operational change.
- Record the source and target image tag and the image ID/digest actually used.
  A floating source tag is not sufficient evidence by itself.

## Rehearsal

Choose new output paths. The commands below never select a backup implicitly and
never overwrite an existing report or dump.

Before the timed run, record the images resolved by Compose and the running
PostgreSQL 17 container. The final PostgreSQL 18 change must use the exact same
target tag and digest as the successful rehearsal.

```bash
docker compose -f compose.yml config --images
docker inspect --format '{{.Config.Image}}|{{.Image}}' \
  "$(docker compose -f compose.yml ps -q db)"
docker image inspect pgvector/pgvector:pg17 \
  --format '{{json .RepoDigests}}'
docker compose -f compose.pg18-rehearsal.yml config --images
```

1. Record the PostgreSQL 17 source manifest before the dump:

   ```bash
   bun apps/server/scripts/validate-postgres-rehearsal.ts \
     --compose-file compose.yml \
     --service db \
     --expected-major 17 \
     --expect-vector-unavailable \
     --output /tmp/solid-imager-pg17-source.json
   ```

2. Create an atomic custom-format dump without a TTY:

   ```bash
   bun apps/server/scripts/dump-db.ts \
     --compose-file compose.yml \
     --service db \
     --output /tmp/solid-imager-pg17-source.dump
   ```

3. Start only the isolated PostgreSQL 18 service:

   ```bash
   docker compose -f compose.pg18-rehearsal.yml up -d --wait db-pg18-rehearsal
   ```

4. Restore into the verified-empty PostgreSQL 18 database:

   ```bash
   bun apps/server/scripts/restore-db.ts \
     --compose-file compose.pg18-rehearsal.yml \
     --service db-pg18-rehearsal \
     --input /tmp/solid-imager-pg17-source.dump \
     --confirm-empty-target
   ```

5. Point Drizzle explicitly at the PostgreSQL 18 rehearsal port and apply all
   migrations. `DB_USER`, `DB_PASSWORD`, and `DB_DATABASE` must match the
   rehearsal Compose environment. This applies the target schema after restore
   and must not be skipped.

   ```bash
   DB_HOST=127.0.0.1 \
   DB_PORT="${PG18_REHEARSAL_PORT:-55432}" \
   bun run --cwd apps/server db:migrate
   ```

6. Run `ANALYZE`, verify PostgreSQL 18 and pgvector 0.8.5, exercise a rolled
   back read/write probe and vector query, and compare exact source-table
   counts, migration hash prefix, and source constraint definitions with the
   source manifest. Target-only `media_regions` and `ccip_embeddings` are
   allowed only at their expected count of zero:

   ```bash
   bun apps/server/scripts/validate-postgres-rehearsal.ts \
     --compose-file compose.pg18-rehearsal.yml \
     --service db-pg18-rehearsal \
     --expected-major 18 \
     --expected-vector-version 0.8.5 \
     --expected-report /tmp/solid-imager-pg17-source.json \
     --output /tmp/solid-imager-pg18-target.json
   ```

7. Build and start the application against PostgreSQL 18 in a separate
   terminal. Use the same `DB_USER`, `DB_PASSWORD`, and `DB_DATABASE` as the
   rehearsal service.

   ```bash
   bun run --cwd apps/server build

   DB_HOST=127.0.0.1 \
   DB_PORT="${PG18_REHEARSAL_PORT:-55432}" \
   NITRO_HOST=127.0.0.1 \
   NITRO_PORT=3100 \
   bun run --cwd apps/server start
   ```

   From another terminal, exercise the `/sources` SSR route, which performs an
   application-level database read:

   ```bash
   curl --fail --show-error --silent http://127.0.0.1:3100/sources \
     > /dev/null
   ```

   HTTP success is necessary but not sufficient: verify that the application
   log has no database connection, migration, query, or SSR errors. Keep job
   inputs quiesced while testing. The production startup plugin starts the job
   worker and startup maintenance, so application startup is not a read-only
   probe and must be treated as the first possible PostgreSQL 18 write during a
   final cutover.

Any non-empty `mismatches` array or non-zero exit status fails the rehearsal.
Retain both JSON reports with the dump's operational record.

## Jobs WAL maintenance

`jobs` was historically UNLOGGED. Rewriting it is deliberately outside normal
Drizzle startup migrations. First stop all job workers and run the read-only
audit, then use the explicit confirmation flag during an approved maintenance
window:

```bash
bun apps/server/scripts/set-jobs-logged.ts
bun apps/server/scripts/set-jobs-logged.ts --apply --confirm-jobs-quiesced
```

The apply path refuses active jobs or invalid backfill/dedupe state, takes an
advisory lock, uses a five-second lock timeout, and verifies `relpersistence=p`.

## Separately approved final cutover

The PostgreSQL major-cutover gate and the CCIP read-cutover gate are independent;
do not combine them in one maintenance window. The approved PostgreSQL window
must stop writers, create a fresh dump, restore into a new PostgreSQL 18 volume,
apply migrations, repeat validation and application readiness, and only then
change the default compose image and volume layout.

Rollback is required for any count/migration/constraint mismatch, invalid
constraint, vector failure, or application readiness failure.
Before the first PostgreSQL 18 application write, rollback means returning the
application to the preserved PostgreSQL 17 service/image recorded during the
rehearsal. After the first PostgreSQL 18 write, there is no reverse
synchronization to PostgreSQL 17, so a simple switch back would lose writes and
is not a rollback. Never reuse a PostgreSQL 17 data directory directly with
PostgreSQL 18.

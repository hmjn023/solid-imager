# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Runtime is **Bun**. Root scripts delegate to workspaces via `bun --filter`.

```bash
bun run dev                  # Server dev (TanStack Start) — the default dev target
bun run dev:tauri            # Tauri desktop dev (Rust + Solid)
bun run build                # Build every workspace
bun run start                # Run built server (runs pglite migrate first)
bun run ai:start             # Python FastAPI AI service on :8000 (uv)

bun run test                 # server unit + integration + cli + core + ui (sequential)
bun run typecheck            # tsc --noEmit across workspaces
bun run lint                 # Biome via vite-plus (`vp run lint`)
bun run check                # Biome check --fix --unsafe
bun run format               # Biome format --fix
```

Server-specific (run from repo root):

```bash
bun --filter @solid-imager/server run test:unit        # vitest, mocks DB
bun --filter @solid-imager/server run test:integration # vitest, PGlite + real migrations, singleFork
bun --filter @solid-imager/server run test:e2e        # Playwright
bun --filter @solid-imager/server run db:generate      # drizzle-kit generate (after schema edits)
bun --filter @solid-imager/server run db:migrate       # apply to Postgres
bun --filter @solid-imager/server run db:studio        # drizzle-kit studio
```

Run a single vitest file: `bun --filter @solid-imager/server run test:unit -- path/to/file.test.ts`.

PostgreSQL for development runs via `sudo -E docker compose --project-directory . up -d` (postgres:17, data in `./db-data/`). Set `DB_HOST=pglite` in `apps/server/.env` to use in-memory PGlite instead (used by tests and Tauri).

## Tech stack callouts

These naming details bite often — do not revert them:

- **TanStack Start** (the Solid variant, `@tanstack/solid-start`), not SolidStart. File-based routing via `@tanstack/solid-router`. Any doc or comment saying "SolidStart" is wrong.
- **Nitro** is the server runtime (`nitro/vite` plugin, `apps/server/server/plugins/bootstrap.ts`). Earlier versions used Elysia — any Elysia reference is legacy and should be removed.
- **oRPC** handler is mounted at `/api/rpc/*` via `apps/server/src/routes/api/rpc.$.ts` using `RPCHandler` from `@orpc/server/fetch`.
- **UI**: Kobalte + Tailwind + solid-ui (shadcn/ui port).
- **Vite+ (`vp`)** wraps Vite/Vitest/Biome/tsdown. Scripts use `vp run <script>` for name-collision scripts. Don't install `vitest` or `oxlint` directly.

## Architecture

Monorepo workspaces:

- `apps/server/` — TanStack Start app. Backend API (oRPC) + SSR UI in one bundle. Clean Architecture layers under `src/`: `infrastructure/` (Drizzle, repositories, oRPC routers, FS, AI client, job queue) → `application/` (services, use cases, registry) → core types imported from `@solid-imager/core`.
- `apps/tauri/` — Desktop shell. Same Solid UI, but DB is PGlite (Wasm) via `getTauriAppServices().db`. Repositories live at `apps/tauri/src/infrastructure/local-api/repositories/`. Rust commands under `src-tauri/src/commands/` (e.g., file watching, backup).
- `apps/cli/` — `imager-cli` Bun-compiled single-binary tool (media sync, DB dump/restore via `pg_dump`/`psql`).
- `apps/xtracter/` — Browser extension for web scraping into sources.
- `packages/core/` — Domain layer. Zod schemas at `src/domain/{entity}/schemas.ts`, repository interfaces at `src/domain/repositories/`. **No dependencies on infrastructure.**
- `packages/ui/` — Shared Solid components.
- `src-python/` — FastAPI AI service (`/tag`, `/ccip/feature`, `/ccip/difference`) using dghs-imgutils / PixAI tagger. Optional; server degrades gracefully if `API_BASE_URL` is unset.

### Hard rules

These are enforced by review and prior incidents:

- **No `as unknown as DomainModel`.** Every repository must expose a `mapToX(dbRow): X` function that explicitly converts DB rows (snake_case, nullable) to domain types (camelCase, `undefined`). Server and Tauri implementations share the _mapping logic_ even though the repository shape differs (class vs. object literal).
- **Safe DTO pattern on every oRPC response that touches `MediaSource`, `User`, or `AppConfig`.** Strip `password`/`privateKey` (SFTP), `secretAccessKey`/`accessKeyId` (S3), etc. Conversion functions (`toSafeMediaSource`) live in the router file. `SafeX` schemas live in `packages/core`.
- **UUID v4 everywhere**, and intermediate tables are named `media_{entity}` (e.g., `media_tags`, `media_characters`).
- **Schema-driven oRPC.** Zod schema in `packages/core` first → router input/output → service → repository. Don't invent ad-hoc response shapes in handlers.
- **Integration tests must not mock the DB.** `apps/server/src/tests/setup-integration.ts` spins up an in-memory PGlite and runs real drizzle migrations; `singleFork` keeps them serial. Mocking here has previously hidden migration regressions. Only `test:unit` uses `vi.mock` for repositories.

### Server ↔ Tauri parity

Same responsibility on both sides must keep the same UI shape, API surface, and backend behavior. Do not land a feature on only one side. Shared logic belongs in `packages/core` or `packages/ui`, not duplicated per app.

Current accepted parity exceptions (from AGENTS.md):

- `apps/tauri`'s `index` / `about` shell pages
- Tauri remote sources (`sftp` / `s3`)
- Tauri standalone AI (AI stays server-delegated)
- Tauri's top navigation bar takes precedence — don't drag server's version into it

When porting between sides, follow `.agents/skills/shared-ui-parity/SKILL.md`.

### Drizzle migrations

Files in `apps/server/drizzle/` are **shared with the Tauri app** (via `db:migrate:pglite`). Never edit or delete old migration files — always generate a new one with `db:generate`.

## Further reading

- `AGENTS.md` — full rule set (parity exceptions, skills list, Vite+ workflow)
- `.indexion/wiki/` — in-repo wiki. Notable pages: `architecture.md`, `db-schema.md`, `orpc-flow.md`, `safe-dto.md`, `repository-rules.md`, `testing.md`, `server-tauri-parity.md`, `search-design.md`, `backup-restore.md`, `deploy.md`, `ai-service.md`
- `docs/design/api-design.md` — API design notes
- `apps/server/src/infrastructure/db/schema.ts` — canonical DB schema

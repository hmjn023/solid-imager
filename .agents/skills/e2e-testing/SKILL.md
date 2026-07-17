---
name: e2e-testing
description: Isolated Solid Imager web E2E testing with Playwright, including dev and fresh-production servers, direct URL/F5 SSR checks, loading/error/offline recovery, CCIP/LanceDB jobs, SSE reconnects, browser health assertions, and responsive viewports. Use when adding, debugging, or validating web E2E coverage.
---

# Solid Imager E2E Testing

Use the isolated harness for all browser regression work. It creates a temporary PGlite database, media directory, thumbnails, LanceDB directories, route-tree placeholder, dynamic HTTP/HMR ports, and (for production) a temporary Nitro output. Never point E2E at the user's configured database or media directory.

## Commands

Run from the repository root:

```bash
bun run --cwd apps/server test:e2e              # dev + fresh production
bun run --cwd apps/server test:e2e:dev          # dev only
bun run --cwd apps/server test:e2e:production   # production only
bun run --cwd apps/server test:e2e:dev -- ccip-flow.spec.ts
bun run --cwd apps/server test                  # unit, integration, then both E2E modes
```

The harness is intentionally local. Do not reintroduce a GitHub Actions E2E job unless the project explicitly accepts the native AI dependency and model-cache cost.

## Harness architecture

- `apps/server/scripts/run-e2e.ts` allocates independent HTTP and HMR ports and runs each requested mode in a unique `/tmp/solid-imager-e2e/<mode>-<uuid>` directory.
- `apps/server/scripts/e2e-server.ts` seeds two deterministic images, migrates PGlite, writes an isolated config, and verifies TanStack route-tree generation through a placeholder.
- `apps/server/playwright.config.ts` starts the isolated server, captures traces/screenshots/videos on failure, and runs desktop plus 320/375/768 responsive projects.
- `apps/server/src/tests/e2e/support/test.ts` installs browser-health checks. Unexpected console errors, page errors, route errors, `[object Object]`, failed requests, and 4xx/5xx responses fail the test unless explicitly allowed.

## Required coverage

When changing routes, loaders, query state, or async UI, cover both SPA navigation and direct URL/F5. Assert visible content after hydration, not only HTTP status:

- App shell and route-specific pending state remain visible during delayed API responses.
- Error, offline, connection-failed/refused/reset, timeout, and 503 states are recoverable after retry/reload.
- Existing result content and focused form values survive background refetch.
- Media detail reloads and search reloads do not produce hydration mismatch, route error, or `[object Object]`.
- Responsive Search controls have no horizontal overflow at representative widths.

For source/job changes, add an SSE test that exercises reconnect and verifies dialog, input value, and focus are preserved while a real source event refreshes content.

For CCIP changes, `ccip-flow.spec.ts` must exercise real extraction, completion state, Find Similar, and the pending-request/F5 recovery path. Keep native inference enabled in this isolated test; do not replace the job with a mocked successful response.

## Async job and realtime pitfalls

- `MediaSidebar` observes `job-completed` and polls `ai.ccipVectorStatus`; a job event is not proof that a client-side query has refreshed.
- Keep job event handling through `useBatchJobEvents` and `subscribeToEventStream`; do not add direct `EventSource` or custom polling streams.
- Source events are not replayed. In reconnect tests, wait for the second SSE connection before triggering the source sync.
- Playwright `page.route()` can alter browser networking behavior (including cache), so use it only for deliberate delay/failure injection. Back the bug with a server/integration test when the failure involves persistence or multiple server module generations.
- Dev HMR can leave worker and API code holding separate LanceDB Table handles. `LanceDbCcipVectorStore` must use strong read consistency (`readConsistencyInterval: 0`) when a completed write must be immediately visible to another reader.
- Add a real LanceDB integration test with two open store instances: open the reader, write through the writer, then assert the reader sees the new vector.

## Debugging workflow

1. Reproduce in dev and production separately; then distinguish SPA navigation, direct URL, and F5.
2. Inspect browser console, page errors, network method/status/body, and the post-hydration accessibility tree. With `agent-browser`, use `open`, `snapshot -i`, `network requests`, and `screenshot`; close the session afterward.
3. Check whether the failure is client state, SSE delivery, job completion, or persistence visibility. Do not classify a stale-vector error as an SSR issue without checking the LanceDB reader snapshot.
4. Add a deterministic regression test before changing timing thresholds. Prefer a real isolated fixture over sleeps.
5. Run the focused E2E, relevant unit/integration tests, typecheck, Biome, and production E2E before the full local gate.

## Test quality rules

- Use semantic locators and stable fixture constants from `support/fixture.ts`.
- Wait for explicit UI state or network response predicates; avoid arbitrary sleeps except for controlled reconnect backoff.
- Allow expected failures through `browserHealth.allowRequestFailure`, `allowResponseFailure`, or `allowConsole`; do not weaken global assertions.
- Keep every test isolated and idempotent. Temporary runtime data must be removed after successful runs and retained on failure for diagnosis.
- Do not add Firefox/Safari/Tauri projects solely to compensate for a server consistency bug; first add a deterministic backend/integration regression. Add cross-browser projects when the browser behavior itself is the subject.

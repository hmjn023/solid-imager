# Implementation Tasks: Effect.ts Backend Refactoring

This document breaks down the work required to introduce Effect.ts into the backend, starting with the `media-source-service`.

## Phase 1: Setup and Core Infrastructure

- [ ] **Task 1: Add Dependency**: Add `effect` to the project's dependencies in `package.json`.
  - `bun add effect`

- [ ] **Task 2: Define `DbError`**: Create a new file `src/infrastructure/db/errors.ts` and define the generic `DbError` class as specified in `data-model.md`.

- [ ] **Task 3: Create Database Service Context (Tag)**: Create a new file `src/infrastructure/db/tag.ts` to define the `Database` context tag for dependency injection.

- [ ] **Task 4: Create Database Service Layer**: Create a new file `src/infrastructure/db/layer.ts` that provides the `DatabaseLive` layer, which constructs the Drizzle instance using the existing `pg.Pool`.

## Phase 2: Refactor Media Source Service

- [ ] **Task 5: Refactor `media-source-service.ts`**: Modify the functions in `src/application/services/media-source-service.ts` to return `Effect` types instead of Promises.
    - Import the `Database` tag and use `Effect.withDo` or `Effect.gen` to access the database service.
    - Wrap all Drizzle queries with `Effect.tryPromise`, mapping errors to the `DbError` type.
    - Update function signatures to match the `contracts/media-source-service.md` file.

- [ ] **Task 6: Update API Routes**: Refactor the API routes that use `media-source-service` to handle the new `Effect`-based return types.
    - **Target files**: `src/routes/api/sources/index.ts` and `src/routes/api/sources/[sourceId]/index.ts`.
    - Import the service functions, the `DatabaseLive` layer, and `Effect`.
    - Create the `program` and `runnable` effects as outlined in `research.md`.
    - Use `Effect.runPromise` within a `try/catch` block to execute the effect and return the appropriate HTTP response.
    - Implement the one-line error logging as specified.

## Phase 3: Verification

- [ ] **Task 7: Run E2E Tests**: Execute the existing Playwright E2E test suite for media sources (`sources.spec.ts`) to ensure no regressions have been introduced. All tests must pass.

- [ ] **Task 8: Run Build**: Run `bun run build` to confirm that the changes build successfully without any new errors or warnings.

# Tasks for Feature: Fix and Enhance Database Tests

**Feature Branch**: `011-fix-db-tests`

This document outlines the dependency-ordered tasks required to fix the test suite.

---

### Phase 1: Prerequisites & Initial Fixes

-   **T001 (Setup)**: Apply database migrations to synchronize the test database schema with the application schema.
    -   **File(s)**: `drizzle/` folder, affects the test database.
    -   **Action**: Run the command `bun run db:migrate`.
    -   **Depends On**: None

-   **T002 (Fix)**: Correct the invalid SQL query generation in the `collections` integration test.
    -   **File(s)**: `src/tests/integration/queries/collections.test.ts`
    -   **Action**: Inspect the `beforeAll` and `afterAll` hooks and fix the `db.delete()` calls to generate valid SQL.
    -   **Depends On**: T001

---

### Phase 2: Fix Failing Tests (Parallelizable)

These tasks can be worked on in parallel after T001 is complete. The main action is to remove the `.skip` modifiers and fix any remaining logic errors now that the schema is correct.

-   **T003 (Test) [P]**: Fix tests for the core `media` service.
    -   **File(s)**:
        -   `src/tests/integration/media/update-media-integration.test.ts`
        -   `src/tests/integration/media/add-media-integration.test.ts`
        -   `src/tests/integration/media/delete-media-integration.test.ts`
        -   `src/tests/integration/media/get-media-integration.test.ts`
        -   `src/tests/integration/media/list-media-integration.test.ts`
    -   **Depends On**: T001

-   **T004 (Test) [P]**: Fix query tests affected by the missing `status` column in the `media` table.
    -   **File(s)**:
        -   `src/tests/integration/queries/bulk-operations.test.ts`
        -   `src/tests/integration/queries/media-generation-info.test.ts`
        -   `src/tests/integration/queries/media-random.test.ts`
        -   `src/tests/integration/queries/media-recent.test.ts`
        -   `src/tests/integration/queries/media.test.ts`
        -   `src/tests/integration/queries/search.test.ts`
        -   `src/tests/integration/queries/tags.test.ts`
    -   **Depends On**: T001

-   **T005 (Test) [P]**: Fix query tests affected by the missing `source` column.
    -   **File(s)**:
        -   `src/tests/integration/queries/categories.test.ts`
        -   `src/tests/integration/queries/characters.test.ts`
        -   `src/tests/integration/queries/ips.test.ts`
    -   **Depends On**: T001

---

### Phase 3: Final Validation

-   **T006 (Polish)**: Perform a final, full run of the entire test suite to ensure all tests pass.
    -   **File(s)**: All test files.
    -   **Action**: Run the command `bun run test`.
    -   **Depends On**: T002, T003, T004, T005

---

### Parallel Execution Example

Once T001 is complete, you can assign the parallelizable tasks to multiple agents:

-   **Agent 1**: `Execute task T002`
-   **Agent 2**: `Execute task T003`
-   **Agent 3**: `Execute task T004`
-   **Agent 4**: `Execute task T005`

After all are complete, one agent can run the final validation task `T006`.

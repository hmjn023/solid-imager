# Tasks for Feature: Fix and Enhance Database Tests

**Feature Branch**: `011-fix-db-tests`

This document outlines the dependency-ordered tasks required to fix the test suite.

---

### Phase 1: Prerequisites & Initial Fixes

-   **T001 (Setup)**: [X] Apply database migrations to synchronize the test database schema with the application schema.
-   **T002 (Fix)**: [X] Correct the invalid SQL query generation in the `collections` integration test.

---

### Phase 2: Fix Failing Tests (Parallelizable)

-   **T003 (Test) [P]**: [X] Fix tests for the core `media` service.
-   **T004 (Test) [P]**: [X] Fix query tests affected by the missing `status` column in the `media` table.
-   **T005 (Test) [P]**: [X] Fix query tests affected by the missing `source` column.

---

### Phase 3: Final Validation

-   **T006 (Polish)**: [X] Perform a final, full run of the entire test suite to ensure all tests pass.

---

### Parallel Execution Example

Once T001 is complete, you can assign the parallelizable tasks to multiple agents:

-   **Agent 1**: `Execute task T002`
-   **Agent 2**: `Execute task T003`
-   **Agent 3**: `Execute task T004`
-   **Agent 4**: `Execute task T005`

After all are complete, one agent can run the final validation task `T006`.

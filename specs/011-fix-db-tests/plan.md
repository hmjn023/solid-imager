# Implementation Plan: `011-fix-db-tests`

**Feature Branch**: `011-fix-db-tests`  
**Created**: 2025-10-21

## 1. Technical Context

-   **Objective**: The primary goal is to repair the test suite, which is currently failing due to a desynchronization between the application's data schema and the test database schema. The work involves applying database migrations, fixing broken test logic, and re-enabling a large number of skipped tests.
-   **Key Technologies**: `vitest`, `drizzle-orm`, `postgres`
-   **Affected Components**:
    -   Test files within `src/tests/integration/` and `src/tests/db/`.
    -   Database migration scripts in the `drizzle/` folder.
    -   CI/CD test execution workflow.

## 2. Constitution Check

-   [X] **Clarity & Focus**: The plan is focused on a single, clear goal: fixing the tests.
-   [X] **Simplicity & Efficiency**: The plan prioritizes the most direct path to a solution: migrate the DB, then fix the code.
-   [X] **Quality & Reliability**: This entire feature is dedicated to improving the quality and reliability of the codebase.
-   [X] **Autonomy & Automation**: The outcome will enable better automation via a stable CI pipeline.

**Result**: The plan is in full compliance with the project constitution.

## 3. Implementation Phases

### Phase 0: Research & Analysis (Completed)

-   **Task 1**: Execute the test suite (`bun run test`) to capture all current failures and skipped tests.
-   **Task 2**: Analyze the error logs to identify the root causes.
-   **Outcome**: The research, documented in `research.md`, confirmed that the primary issues are a stale database schema and a minor bug in one test file.

### Phase 1: Schema Correction and Initial Fixes

-   **Task 1: Apply Database Migrations**: Run the migration command to update the test database schema.
    -   **Command**: `bun run db:migrate`
    -   **Verification**: The command should complete successfully.

-   **Task 2: Fix Invalid Query in `collections.test.ts`**: Correct the `db.delete()` call that is generating invalid SQL.
    -   **File**: `src/tests/integration/queries/collections.test.ts`
    -   **Change**: Modify the `beforeAll` and `afterAll` hooks to correctly call the delete function.
    -   **Verification**: The `collections.test.ts` suite should pass when run individually.

-   **Task 3: Re-run Test Suite**: After the above fixes, run the full test suite again.
    -   **Command**: `bun run test`
    -   **Verification**: The number of failures should be significantly reduced. The only remaining failures should be in tests that were explicitly skipped.

### Phase 2: Re-enabling and Verifying Skipped Tests

-   **Task 1: Iteratively Un-skip and Validate**: Go through the list of skipped test suites from the initial test run.
    -   **Files**: All files listed in `research.md` that contain skipped tests.
    -   **Change**: For each file, remove the `.skip` modifier from the `describe` or `test` blocks.
    -   **Verification**: Run the tests for each modified file to ensure they now pass. If they fail, fix the underlying test logic.

-   **Task 2: Final Full Test Run**: After all tests have been un-skipped and fixed, run the entire suite one last time.
    -   **Command**: `bun run test`
    -   **Verification**: The command must complete with 100% of tests passing.

## 4. Validation

-   [ ] All tests pass in the local environment.
-   [ ] A pull request is opened, and all CI checks (including the test suite) pass.
-   [ ] The final test coverage percentage is equal to or greater than the coverage before the changes.
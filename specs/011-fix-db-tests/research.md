# Research for `011-fix-db-tests`

**Date**: 2025-10-21

## Objective

The goal of this research is to identify the root causes of the test failures and create a concrete plan to fix them. The initial feature description indicates that recent database schema changes have broken the test suite.

## Investigation & Findings

An initial run of the test suite (`bun run test`) was performed to gather data on the failures.

### 1. Root Cause Analysis: Schema Mismatch

The vast majority of test failures are due to a clear mismatch between the application's expected database schema and the actual schema present in the test database.

- **Error Message**: `Caused by: error: column "status" of relation "media" does not exist`
- **Affected Tables**: `media`, `categories`, `ips`.
- **Analysis**: The test code, through the Drizzle ORM, is attempting to query columns (`status`, `source`) that are defined in the latest schema design (`docs/design/04-database-design.md`) but do not exist in the currently running test database. This indicates that the database migrations have not been applied to the test environment.

- **Decision**: The test database schema must be updated to match the current application schema.
- **Rationale**: This will resolve all errors related to missing columns and is the prerequisite for fixing any other test logic.
- **Action**: Run the database migration command: `bun run db:migrate`.

### 2. Root Cause Analysis: Invalid Query Generation

- **Error Message**: `Caused by: error: syntax error at or near "where"`
- **Affected File**: `src/tests/integration/queries/collections.test.ts`
- **Analysis**: The test is generating an invalid SQL query: `delete from  where true`. The table name is missing. This points to a bug in the test's query construction, specifically in the `beforeAll` and `afterAll` hooks where the database is being cleaned up.

- **Decision**: The query construction in the specified test file must be corrected.
- **Rationale**: Even after the schema is fixed, this test will continue to fail due to invalid SQL.
- **Action**: Inspect `src/tests/integration/queries/collections.test.ts` and correct the `db.delete()` calls.

### 3. Skipped Tests

- **Finding**: A significant number of tests (61) are currently skipped.
- **Analysis**: These tests were likely skipped to prevent CI failures when the breaking schema changes were introduced. Once the primary failures are resolved, these tests need to be re-enabled to ensure full test coverage.
- **Decision**: All skipped tests in the affected test suites must be un-skipped and verified.
- **Rationale**: To fulfill the feature's goal of a fully passing and comprehensive test suite.
- **Action**: Search for `.skip` modifiers in the test files and remove them. Run the tests to ensure they pass.

## Summary of Files to Modify

Based on the test output, the following files will require changes (either fixing the test logic or un-skipping tests):

- `src/tests/integration/media/update-media-integration.test.ts`
- `src/tests/integration/media/add-media-integration.test.ts`
- `src/tests/integration/media/delete-media-integration.test.ts`
- `src/tests/integration/media/get-media-integration.test.ts`
- `src/tests/integration/media/list-media-integration.test.ts`
- `src/tests/integration/queries/bulk-operations.test.ts`
- `src/tests/integration/queries/categories.test.ts`
- `src/tests/integration/queries/characters.test.ts`
- `src/tests/integration/queries/collections.test.ts`
- `src/tests/integration/queries/ips.test.ts`
- `src/tests/integration/queries/media-generation-info.test.ts`
- `src/tests/integration/queries/media-random.test.ts`
- `src/tests/integration/queries/media-recent.test.ts`
- `src/tests/integration/queries/media.test.ts`
- `src/tests/integration/queries/search.test.ts`
- `src/tests/integration/queries/tags.test.ts`

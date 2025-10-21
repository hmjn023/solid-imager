# Quickstart for `011-fix-db-tests`

**Date**: 2025-10-21

This document provides the essential commands to get the test suite running correctly after the required fixes are implemented.

The primary issue is that the test database schema is out of sync with the application schema.

## Steps to Run Tests

1.  **Apply Database Migrations**

    This command updates the test database to the latest schema, which is required for the tests to run correctly.

    ```bash
    bun run db:migrate
    ```

2.  **Run the Test Suite**

    After migrating the database, run the entire test suite to verify that all fixes are working and no regressions have been introduced.

    ```bash
    bun run test
    ```

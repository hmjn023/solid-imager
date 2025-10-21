# Data Model for `011-fix-db-tests`

**Date**: 2025-10-21

This feature does not introduce any new database entities. Instead, it focuses on fixing tests related to existing entities that were affected by recent schema changes.

The test failures indicate that the following tables have a schema mismatch between the application code (Drizzle schema) and the test database. The tests for these entities and their related functions need to be fixed.

## Affected Entities

-   **`media`**
    -   **Issue**: The `status` column is expected by the code but missing in the test database.

-   **`categories`**
    -   **Issue**: The `source` column is expected by the code but missing in the test database.

-   **`ips`**
    -   **Issue**: The `source` column is expected by the code but missing in the test database.

-   **`collections` / `collectionMedia`**
    -   **Issue**: The test code for cleaning up these tables contains a buggy query (`delete from  where true`), which needs to be fixed.

-   **Other Entities**: Many other tests related to entities like `tags`, `characters`, `media_generation_info`, etc., are failing because their setup depends on inserting data into the `media` table, which fails due to the schema mismatch. Fixing the primary entities will likely resolve these cascading failures.

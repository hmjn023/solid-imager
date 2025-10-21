# Feature Specification: Fix and Enhance Database Tests

**Feature Branch**: `011-fix-db-tests`
**Created**: 2025年10月21日
**Status**: Draft
**Input**: User description: "@docs/design/04-database-design.md @docs/design/06-feature-details.md 現在DBのスキーマを変更したのとDB操作関数を編集、追加した影響でテストが正常に動作していない テストを修正するとともに足りていないテストを追加したい"

## Clarifications

### Session 2025-10-21
- Q: テスト実行中にデータベースに接続できない場合、テストスイートはどのように振る舞うべきですか？ → A: データベースに依存するテストをスキップし、警告を報告する。
- Q: データベースを扱うテスト同士が互いに影響を与えないようにするため、どのような分離戦略を採用すべきですか？ → A: 個別のテストケース（またはテストファイル）をDBトランザクションでラップし、完了後にロールバックする。
- Q: 今回のテスト修正・追加作業に、データベースの競合状態を想定したテストの実装も含めるべきですか？ → A: いいえ、競合状態のテストは将来のパフォーマンス/負荷テストのフェーズに延期する。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ensure Test Suite Reliability (Priority: P1)

As a developer, I want to run the entire test suite without any failures, so that I can confidently merge new code and deploy changes without introducing regressions.

**Why this priority**: This is critical for maintaining code quality, enabling continuous integration, and preventing bugs from reaching production. A reliable test suite is the foundation of stable development.

**Independent Test**: This can be tested by running the full test command (e.g., `bun test`). The value is delivered when the command completes successfully with all tests passing.

**Acceptance Scenarios**:

1.  **Given** the latest code from the `main` branch, **When** the test suite is executed, **Then** all tests should pass, and the test run should exit with a success code.
2.  **Given** a pull request with new changes, **When** the CI pipeline runs the test suite, **Then** all tests must pass for the PR to be mergeable.

---

### User Story 2 - Validate New and Modified DB Functions (Priority: P2)

As a developer, I want to see specific tests for all new and recently modified database functions, so that I can be sure that the data logic is correct and performs as expected.

**Why this priority**: New or changed logic is a common source of bugs. Explicit tests for these functions are necessary to verify their correctness and prevent data corruption or incorrect query results.

**Independent Test**: This can be tested by inspecting the test files related to database operations and verifying that tests exist for the new/modified functions. Running these specific tests should result in a pass.

**Acceptance Scenarios**:

1.  **Given** a new database function `db.insertMedia(...)`, **When** I look at the corresponding test file, **Then** I should find a test case that verifies its insertion logic, including handling of valid and invalid inputs.
2.  **Given** a modified database function `db.updateMedia(...)`, **When** the relevant tests are run, **Then** the tests should confirm the updated behavior is correct and doesn't break existing functionality.

---

### Edge Cases

-   **If the database is unreachable during a test run**, any test requiring a database connection MUST be skipped and reported as a warning, rather than failing the entire suite.
-   To ensure test isolation, each test case (or test file) that interacts with the database MUST be wrapped in a transaction that is rolled back upon test completion.

## Requirements *(mandatory)*

### Functional Requirements

-   **FR-001**: The test suite MUST be updated to reflect all recent changes in the database schema (`04-database-design.md`).
-   **FR-002**: All existing unit and integration tests that are currently failing due to schema or function signature changes MUST be fixed.
-   **FR-003**: The entire test suite MUST execute without any failing tests.
-   **FR-004**: New unit and/or integration tests MUST be created for every new or significantly modified database operation function listed in `06-feature-details.md`.
-   **FR-005**: The overall test coverage for database interaction logic MUST be maintained or increased.

## Out of Scope

- Testing for database race conditions or other concurrency issues is explicitly deferred to a future performance/stress testing phase.

### Key Entities *(include if feature involves data)*

This feature impacts tests related to all major database entities, including:
-   **media_sources**: Manages the different locations of media files.
-   **media**: Core table for all media file information.
-   **tags**: Stores tags for media.
-   **media_tags**: Links media and tags.
-   **media_details**: Stores ratings, favorites, etc.
-   **media_generation_info**: Stores AI generation metadata.
-   **categories**, **projects**, **ips**, **characters**: Organizational entities.
-   **jobs**: Manages background tasks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

-   **SC-001**: 100% of tests in the test suite pass when run in the CI/CD environment.
-   **SC-002**: The number of failing tests related to database operations is reduced from the current number to zero.
-   **SC-003**: Test coverage for modules containing database logic (e.g., services in `src/application/services` and db functions) is at least 85%.
-   **SC-004**: No new bugs or regressions related to database operations are reported in the 2 weeks following the deployment of these test fixes.
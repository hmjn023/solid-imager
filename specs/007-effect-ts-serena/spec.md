# Feature Specification: Introduce Effect.ts to Backend Services

**Feature Branch**: `007-effect-ts-serena`  
**Created**: 2025-10-13
**Status**: Draft  
**Input**: User description: "Effect.ts を導入したい、まずはバックエンド側のみの回収で構わない、フロントエンドには手をつけないこと serenaを使用"

## Clarifications

### Session 2025-10-13

- Q: `Effect`のパイプライン内でキャッチされたエラーは、どのようにログ記録されるべきですか？ → A: 要約された1行のメッセージ（例: `ERROR: DbError in media-source-service`）をログに出力する
- Q: 今回のリファクタリングに、パフォーマンスに関する要件はありますか？ → A: 現在のPromiseベースの実装と同等か、それ以上のパフォーマンスを維持する必要があります。
- Q: データベース操作に起因する型付きエラー（Typed Errors）は、どの程度の粒度で定義すべきですか？ → A: まずは汎用的な `DbError` のみ定義し、すべてのデータベース関連エラーに使用する。

## User Scenarios & Testing *(mandatory)*

This feature is a backend refactoring effort to improve long-term stability and maintainability. The "user" is the developer and the system itself.

### User Story 1 - Refactor Core Service with Effect.ts (Priority: P1)

As a developer, I want to refactor the `media-source-service` and its corresponding API routes to use `Effect.ts` for handling all asynchronous operations and error management, so that we can establish a robust, type-safe pattern for all future backend development.

**Why this priority**: This is the most critical step. It validates the `Effect.ts` pattern on a core piece of functionality. Success here proves the viability of the approach for the rest of the backend.

**Independent Test**: The refactoring can be tested independently by running the existing E2E tests for Media Sources. The public API contract must not change, meaning the frontend should function exactly as before.

**Acceptance Scenarios**:

1. **Given** a user is on the Media Sources page, **When** the page requests the list of sources, **Then** the `GET /api/sources` endpoint, now powered by Effect, successfully executes its logic and returns the correct list of media sources.
2. **Given** a database error is simulated, **When** a request is made to an endpoint that uses a refactored service, **Then** the Effect pipeline correctly catches the typed `DbError` and the API route returns a standard 500 Internal Server Error response without crashing.
3. **Given** a developer inspects the code, **When** they review `media-source-service.ts`, **Then** all functions return an `Effect` type instead of a `Promise`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST add `effect` as a project dependency.
- **FR-002**: Backend services, starting with `media-source-service.ts`, MUST be refactored to use `Effect.ts` for handling asynchronous operations and error management.
- **FR-003**: The public API contract of the refactored services MUST NOT change. Frontend consumers will not be updated as part of this feature.
- **FR-004**: All database queries within the refactored services MUST be wrapped in an `Effect` (e.g., using `Effect.tryPromise`).
- **FR-005**: The API routes in `src/routes/api/` that use the refactored services MUST be updated to execute the `Effect` program (e.g., using `Effect.runPromise`) and handle its success or failure states to return appropriate HTTP responses.
- **FR-006**: The scope of this refactoring MUST be limited to the backend (primarily `src/application/services`, `src/infrastructure`, and `src/routes/api`). No changes will be made to frontend components.
- **FR-007**: The system MUST log a summarized, one-line message for any errors caught within an Effect pipeline.
- **FR-008**: For the initial implementation, a single generic `DbError` type SHOULD be used for all database-related failures within the Effect pipeline.

### Non-Functional Requirements

- **NFR-001**: The performance of the refactored API endpoints MUST be equal to or better than the previous Promise-based implementation.

### Key Entities

- No new user-facing entities will be introduced. This feature focuses on refactoring the implementation details of existing backend services.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `media-source-service.ts` and its corresponding API routes are fully refactored to use `Effect.ts`.
- **SC-002**: All existing E2E tests related to Media Sources (creating, reading, updating, deleting) MUST pass without modification after the refactoring.
- **SC-003**: The return types of functions within `media-source-service.ts` MUST include a generic `DbError` for database failures (e.g., `Effect.Effect<MediaSource[], DbError>`).
- **SC-004**: The `bun run build` command MUST complete successfully with no new errors or warnings introduced by the changes.

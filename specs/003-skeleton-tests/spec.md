# Feature Specification: Skeleton Test Implementation

**Feature Branch**: `003-skeleton-tests`
**Created**: 2025-10-11
**Status**: Draft
**Input**: User description: "スケルトンテストを実装して" (Implement skeleton tests)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete Test Coverage for All API Routes (Priority: P1)

As a developer maintaining the solid-imager codebase, I want skeleton tests for all API endpoints so that I have a baseline test structure to expand upon when implementing features, ensuring no endpoint goes untested.

**Why this priority**: With 32 API routes and only 31 test files, there's incomplete test coverage. Skeleton tests provide immediate value by establishing the test contract pattern, making it easy to identify what's tested vs untested, and providing a template for future test implementation.

**Independent Test**: Can be fully tested by running `bun test` and verifying that all API routes have corresponding test files with at least one describe block and basic contract tests.

**Acceptance Scenarios**:

1. **Given** an API endpoint exists at `src/routes/api/categories/index.ts`, **When** I look in `src/tests/api/categories/`, **Then** I find a test file with basic GET/POST contract tests
2. **Given** all API routes have skeleton tests, **When** I run `bun test`, **Then** all tests pass with clear TODOs for unimplemented functionality
3. **Given** a skeleton test for POST /api/sources, **When** I review the test, **Then** it validates request schema, expected response structure, and documents edge cases

---

### User Story 2 - Test Organization and Naming Consistency (Priority: P2)

As a developer working on different parts of the codebase, I want consistent test file organization and naming conventions so that I can quickly locate tests for any API endpoint without confusion.

**Why this priority**: The current codebase has mixed naming (camelCase vs kebab-case, duplicates like `addMedia.test.ts` and `add-media.test.ts`). Standardizing this improves developer experience and prevents duplicate test creation.

**Independent Test**: Can be tested by running a script that checks all test files follow the pattern `src/tests/{type}/{feature}/{endpoint}.test.ts` with kebab-case naming.

**Acceptance Scenarios**:

1. **Given** API routes use kebab-case or camelCase, **When** skeleton tests are generated, **Then** all test files use consistent kebab-case naming
2. **Given** an API route at `src/routes/api/sources/[sourceId]/index.ts`, **When** looking for its test, **Then** it's at `src/tests/api/sources/[sourceId]/index.test.ts`
3. **Given** existing duplicate test files, **When** skeleton test generation runs, **Then** it identifies and merges duplicate tests into single files

---

### User Story 3 - Documentation of Test Contracts (Priority: P3)

As a developer implementing new features, I want skeleton tests to document expected input/output contracts so that I understand the API behavior before writing implementation code.

**Why this priority**: Test-driven development (TDD) works best when tests document the intended behavior. Skeleton tests serve as executable documentation, reducing the need to read implementation code to understand contracts.

**Independent Test**: Can be tested by reviewing skeleton test files and verifying each contains JSDoc comments describing request schemas, response types, and error scenarios.

**Acceptance Scenarios**:

1. **Given** a skeleton test for GET /api/sources, **When** I read the test file, **Then** I see documented examples of valid requests, expected responses, and common error cases
2. **Given** an API endpoint uses Zod validation, **When** skeleton test is generated, **Then** it includes tests for schema validation with valid and invalid inputs
3. **Given** an API endpoint has authentication requirements, **When** skeleton test is generated, **Then** it includes tests for authenticated and unauthenticated access

---

### Edge Cases

- What happens when an API route has multiple HTTP methods (GET, POST, PUT, DELETE) but skeleton test only covers one?
- How does the system handle dynamic route parameters like `[sourceId]` and `[...directories]` in test generation?
- What if an API endpoint is deprecated or marked for removal - should skeleton tests be generated?
- How should skeleton tests handle API routes that depend on external services (storage drivers, databases)?
- What if test files already exist but are incomplete - should skeleton tests augment or replace them?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate skeleton test files for all API routes in `src/routes/api/**/*.ts` that don't have corresponding tests
- **FR-002**: System MUST use kebab-case naming convention for all test files (e.g., `add-media.test.ts`, not `addMedia.test.ts`)
- **FR-003**: Skeleton tests MUST include at least one `describe` block per HTTP method supported by the endpoint
- **FR-004**: System MUST validate request schemas using existing Zod schemas where available
- **FR-005**: System MUST document expected response types using TypeScript types from `~/db/schema`
- **FR-006**: Skeleton tests MUST include placeholders for happy path, validation errors, and common edge cases
- **FR-007**: System MUST identify and flag duplicate test files (camelCase vs kebab-case) for manual review
- **FR-008**: Skeleton tests MUST follow existing test patterns from `src/tests/api/media/add-media.test.ts`
- **FR-009**: System MUST organize tests by type: `src/tests/api/` for API contract tests, `src/tests/integration/` for integration tests, `src/tests/unit/` for unit tests
- **FR-010**: System MUST mark unimplemented test assertions with `// TODO:` comments

### Key Entities *(include if feature involves data)*

- **SkeletonTest**: Represents a generated test file with describe blocks, test cases, and TODO markers
  - Properties: filePath, apiRoute, httpMethods[], schemas[], expectedTypes[]

- **APIRoute**: Represents an API endpoint that needs testing
  - Properties: filePath, httpMethods[], parameters[], authentication, schemas[]

- **TestCoverage**: Represents the mapping between API routes and their tests
  - Properties: apiRoute, hasTest, testFilePath, coveragePercentage

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of API routes in `src/routes/api/` have corresponding skeleton test files
- **SC-002**: All skeleton tests pass with `bun test` (using mock/placeholder implementations)
- **SC-003**: All test file names use kebab-case convention consistently
- **SC-004**: Each skeleton test includes at least 3 test cases: happy path, validation error, and one edge case
- **SC-005**: Running `bun test --reporter=verbose` shows clear TODO markers for unimplemented assertions
- **SC-006**: All duplicate test files are identified and documented in a migration report
- **SC-007**: Test organization follows the directory structure: `src/tests/{type}/{feature}/{endpoint}.test.ts`

### Acceptance

All 7 success criteria must be met. Additionally:
- Documentation must be generated listing all skeleton tests created
- A coverage report must show before/after test coverage statistics
- No existing tests should be broken or removed (only augmented or standardized)

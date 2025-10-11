# Research: Skeleton Test Implementation

**Feature**: 003-skeleton-tests
**Date**: 2025-10-11
**Phase**: 0 (Research)

## Executive Summary

The solid-imager codebase has **32 API route files** with **31 test files**, but significant gaps exist in test coverage. Analysis reveals:

1. **13 API routes lack any tests** (41% untested)
2. **10 duplicate test files** exist (camelCase vs kebab-case pairs)
3. **Existing skeleton tests** follow a clear pattern that can be templated
4. **Test organization** is inconsistent across directories

**Recommendation**: Generate skeleton tests for all 13 untested routes, standardize naming to kebab-case, and create a duplicate migration report.

## Current Test Structure

### Test Organization

```
src/tests/
├── api/                    # API contract tests (unit-level)
│   └── media/              # Only media APIs have tests here
│       ├── add-media.test.ts (and addMedia.test.ts duplicate)
│       ├── delete-media.test.ts (and deleteMedia.test.ts duplicate)
│       ├── get-media.test.ts (and getMedia.test.ts duplicate)
│       ├── list-media.test.ts (and listMedia.test.ts duplicate)
│       └── update-media.test.ts (and updateMedia.test.ts duplicate)
├── integration/            # Integration tests with database
│   ├── config-api.spec.ts
│   ├── media-api.spec.ts
│   ├── thumbnails-api.spec.ts
│   └── media/              # Media-specific integration tests (also duplicates)
│       ├── add-media-integration.test.ts (and addMediaIntegration.test.ts)
│       ├── delete-media-integration.test.ts (and deleteMediaIntegration.test.ts)
│       ├── get-media-integration.test.ts (and getMediaIntegration.test.ts)
│       ├── list-media-integration.test.ts (and listMediaIntegration.test.ts)
│       ├── update-media-integration.test.ts (and updateMediaIntegration.test.ts)
│       └── access-denied-integration.test.ts (and accessDeniedIntegration.test.ts)
├── unit/                   # Unit tests for business logic
│   └── api/
│       └── media.test.ts
├── e2e/                    # End-to-end Playwright tests
│   ├── example.spec.ts
│   ├── sources-basic.spec.ts
│   ├── sources.spec.ts
│   └── thumbnails.spec.ts
└── db/                     # Database layer tests
    └── index.test.ts
```

### Naming Convention Issues

**Current state**: Mixed camelCase and kebab-case

**Examples**:
- ✅ `add-media.test.ts` (kebab-case, preferred)
- ❌ `addMedia.test.ts` (camelCase, duplicate)
- ✅ `config-api.spec.ts` (kebab-case)
- ❌ `addMediaIntegration.test.ts` (camelCase)

**Recommendation**: Standardize to kebab-case for all test files.

## API Routes Coverage Analysis

### Total Counts

- **API Routes**: 32 files
- **Test Files**: 31 files (but includes 10 duplicates)
- **Unique Tests**: ~21 effective test files
- **Coverage Gap**: 13 routes without tests (41%)

### Routes WITH Tests

| API Route | Test File | Status |
|-----------|-----------|--------|
| `/api/config` | `integration/config-api.spec.ts` | ✓ Has test |
| `/api/sources` (multiple endpoints) | `e2e/sources*.spec.ts` | ✓ Has e2e tests |
| `/api/sources/[sourceId]/thumbnails` | `integration/thumbnails-api.spec.ts` | ✓ Has test |
| `/api/sources/[sourceId]/[mediaId]` | `integration/media-api.spec.ts` | ✓ Has test |
| `/api/sources/[sourceId]/[mediaId]/thumbnail` | `e2e/thumbnails.spec.ts` | ✓ Has e2e test |
| `/api/sources/[sourceId]/media/[mediaId]/thumbnail` | `e2e/thumbnails.spec.ts` | ✓ Has e2e test |
| `/api/sources/[sourceId]/directories` | `e2e/sources*.spec.ts` | ✓ Partial e2e |
| Media APIs (5 operations) | `api/media/*.test.ts` | ✓ Has contract tests |

### Routes WITHOUT Tests (13 routes)

**Priority 1 (User-facing features)**:
1. `/api/categories/index` (GET, POST)
2. `/api/categories/[id]` (GET, PUT, DELETE)
3. `/api/charactors/index` (GET, POST)
4. `/api/charactors/[id]` (GET, PUT, DELETE)
5. `/api/tags/index` (GET, POST)
6. `/api/tags/[id]` (GET, PUT, DELETE)
7. `/api/ips/index` (GET, POST)
8. `/api/ips/[id]` (GET, PUT, DELETE)

**Priority 2 (Media metadata operations)**:
9. `/api/sources/[sourceId]/[mediaId]/charactors` (GET, POST, PUT, DELETE)
10. `/api/sources/[sourceId]/[mediaId]/details` (GET, PUT)
11. `/api/sources/[sourceId]/[mediaId]/ips` (GET, POST, PUT, DELETE)
12. `/api/sources/[sourceId]/[mediaId]/metadata` (GET, PUT)
13. `/api/sources/[sourceId]/[mediaId]/tags` (GET, POST, DELETE)

**Priority 3 (System operations)**:
14. `/api/sources/[sourceId]/[mediaId]/upload` (POST) - Note: This has implementation but no tests
15. `/api/sources/[sourceId]/directories/create` (POST)
16. `/api/sources/[sourceId]/directories/delete` (DELETE)
17. `/api/sources/[sourceId]/directories/rename` (PUT)
18. `/api/sources/[sourceId]/directories/[...directories]/search` (GET)
19. `/api/sources/[sourceId]/search` (GET)
20. `/api/sources/[sourceId]/status` (GET)
21. `/api/sources/[sourceId]/events` (GET)
22. `/api/sources/[sourceId]/events/thumbnail-progress` (Server-Sent Events)

**Note**: Some routes may have partial e2e coverage but lack unit/contract tests.

## Existing Test Pattern Analysis

### Skeleton Test Template (from `add-media.test.ts`)

The existing skeleton tests follow this pattern:

```typescript
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { [EntityType] } from "~/db/schema";
import { [requestSchema] } from "~/lib/schemas";

describe("[functionName] Contract", () => {
  it("should return a [EntityType] object on successful [operation]", () => {
    // This test will initially fail as [function] is not yet implemented.
    // It serves as a contract definition.
    const newData = {
      // ... example data matching schema
    };

    // Validate with Zod schema
    [requestSchema].parse(newData);

    // Placeholder for the actual function call
    // const result = await [function](newData);
    const result: [EntityType] = {
      id: "mock-uuid-123",
      ...newData,
      // ... additional fields
    };

    expect(result).toBeDefined();
    expect(result.id).toBeTypeOf("string");
    // ... field-specific assertions
  });

  it("should throw a ZodError if required fields are missing or invalid", () => {
    const invalidData = {
      // Missing required fields
    };

    expect(() => [requestSchema].parse(invalidData)).toThrow(ZodError);
  });

  it("should throw an error if [unique constraint violation]", () => {
    // Test duplicate/constraint scenarios
    // await expect([function](data)).rejects.toThrow('...');
  });
});
```

### Key Characteristics

1. **Uses Vitest** as test framework
2. **Zod schemas** for validation testing
3. **TypeScript types** from `~/db/schema`
4. **Three-test structure**:
   - Happy path with mock data
   - Validation error scenarios
   - Business logic constraints (duplicates, authorization, etc.)
5. **TODO comments** for unimplemented functionality
6. **Mock responses** using TypeScript types

### Dependencies Found

- **Test Framework**: Vitest (`describe`, `expect`, `it`)
- **Validation**: Zod (`ZodError`, schemas from `~/lib/schemas`)
- **Types**: `~/db/schema` exports entity types
- **Test Utilities**: `~/tests/setup.ts` (database setup, if needed)

## Duplicate Test Files

### Confirmed Duplicates (10 pairs = 20 files)

**API Contract Tests** (src/tests/api/media/):
1. `add-media.test.ts` ↔ `addMedia.test.ts`
2. `delete-media.test.ts` ↔ `deleteMedia.test.ts`
3. `get-media.test.ts` ↔ `getMedia.test.ts`
4. `list-media.test.ts` ↔ `listMedia.test.ts`
5. `update-media.test.ts` ↔ `updateMedia.test.ts`

**Integration Tests** (src/tests/integration/media/):
6. `add-media-integration.test.ts` ↔ `addMediaIntegration.test.ts`
7. `delete-media-integration.test.ts` ↔ `deleteMediaIntegration.test.ts`
8. `get-media-integration.test.ts` ↔ `getMediaIntegration.test.ts`
9. `list-media-integration.test.ts` ↔ `listMediaIntegration.test.ts`
10. `update-media-integration.test.ts` ↔ `updateMediaIntegration.test.ts`

**Plus one more**:
11. `access-denied-integration.test.ts` ↔ `accessDeniedIntegration.test.ts`

**Total**: 11 pairs (22 duplicate files)

### Migration Strategy

1. **Compare content** of each pair (may be identical or differ)
2. **Keep kebab-case version** as canonical
3. **Merge any unique tests** from camelCase version
4. **Delete camelCase version**
5. **Update any imports** that reference deleted files (unlikely)

## Schema Analysis

### Available Zod Schemas (from `~/lib/schemas`)

Need to verify which schemas exist for the untested routes:

**Likely to exist**:
- `addMediaRequestSchema` ✓ (confirmed in use)
- `createCategorySchema` (needs verification)
- `createCharacterSchema` (needs verification)
- `createTagSchema` (needs verification)
- `createIpSchema` (needs verification)

**May need creation**:
- Schemas for directory operations
- Schemas for metadata operations
- Schemas for search operations

**Action**: Phase 1 will catalog existing schemas and identify gaps.

## Type Analysis

### Available Entity Types (from `~/db/schema`)

Need to verify which types are exported:

**Confirmed**:
- `Media` type (used in existing tests)

**Expected** (based on API routes):
- `Category`
- `Character` (note: API uses "charactors" spelling)
- `Tag`
- `Ip` (Intellectual Property)
- `MediaMetadata`
- `MediaSource`
- `Directory` (if applicable)

**Action**: Phase 1 will catalog exported types.

## HTTP Method Distribution

### Analysis of API Endpoints

**CRUD Patterns**:
- **Categories**: GET (list), POST (create), GET (one), PUT (update), DELETE
- **Characters**: GET (list), POST (create), GET (one), PUT (update), DELETE
- **Tags**: GET (list), POST (create), GET (one), PUT (update), DELETE
- **IPs**: GET (list), POST (create), GET (one), PUT (update), DELETE

**Nested CRUD** (Media relationships):
- **Media Characters**: GET (list), POST (add), PUT (update), DELETE (remove)
- **Media IPs**: GET (list), POST (add), PUT (update), DELETE (remove)
- **Media Tags**: GET (list), POST (add), DELETE (remove)

**Special Operations**:
- **Upload**: POST (file upload)
- **Search**: GET (with query params)
- **Status**: GET (system status)
- **Events**: GET (SSE/streaming)
- **Thumbnails**: GET (image serving)

### Skeleton Test Coverage Plan

Each skeleton test should cover:
1. **One `describe` block per HTTP method** (GET, POST, PUT, DELETE)
2. **Within each method**:
   - Happy path test
   - Validation error test (Zod schema)
   - Edge case test (e.g., not found, duplicate, unauthorized)

**Example**: `/api/categories/index`
```typescript
describe("GET /api/categories", () => {
  it("should return array of categories")
  it("should return empty array when no categories")
});

describe("POST /api/categories", () => {
  it("should create and return new category")
  it("should throw ZodError for invalid data")
  it("should throw error for duplicate name")
});
```

## Technical Constraints

### Framework

- **SolidStart**: SSR framework (not Next.js, not pure React)
- **API Routes**: File-based routing in `src/routes/api/`
- **APIEvent**: SolidStart's request/response abstraction

### Testing Tools

- **Vitest**: Unit/integration test runner
- **Playwright**: E2E test runner
- **Zod**: Runtime validation (already in use)
- **TypeScript**: Strict mode enabled

### Database

- **Drizzle ORM**: Type-safe database client
- **PostgreSQL**: Database (from previous context)
- **Test Database**: Integration tests need database setup

### Dependencies

From previous research (002-serena):
- **Biome 2.2.4**: Linting/formatting
- **TypeScript 5.x**: Type checking
- **Bun**: Runtime and package manager

## Test Generation Strategy

### Phase 1: Generate Skeletons

For each untested API route:
1. **Parse route file** to identify HTTP methods
2. **Check for Zod schemas** in `~/lib/schemas`
3. **Check for entity types** in `~/db/schema`
4. **Generate test file** using template
5. **Organize by route structure** (`src/tests/api/{feature}/{endpoint}.test.ts`)

### Phase 2: Standardize Naming

1. **Identify all duplicate pairs**
2. **Compare file contents** (use `diff`)
3. **Merge unique tests** into kebab-case version
4. **Generate migration report**
5. **Delete camelCase versions**

### Phase 3: Verification

1. **Run `bun test`** to ensure all tests pass
2. **Check for import errors** (unlikely but possible)
3. **Generate coverage report** (before/after)
4. **Document TODO items** for future implementation

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing Zod schemas | High | Generate placeholder schemas or use `z.unknown()` |
| Missing entity types | Medium | Use `Record<string, unknown>` as fallback |
| Breaking existing tests | High | Keep all existing tests, only add new ones |
| File conflicts during generation | Medium | Check file existence before writing |
| Incorrect HTTP method detection | Low | Manual review of generated tests |
| SSE/WebSocket routes need special handling | Medium | Mark with TODO for manual implementation |

## Open Questions

1. **Schema Creation**: Should we generate missing Zod schemas, or leave them as TODOs?
   - **Recommendation**: Leave as TODOs with clear documentation

2. **Duplicate Content**: Do camelCase and kebab-case duplicates have identical content?
   - **Action**: Phase 1 will diff all pairs

3. **Integration vs Unit**: Should skeleton tests be unit tests or integration tests?
   - **Recommendation**: Generate API contract tests (unit-level) first, integration later

4. **Test Data**: Should skeleton tests use realistic data or minimal valid data?
   - **Recommendation**: Minimal valid data with comments showing realistic examples

5. **Authentication**: How should skeleton tests handle authenticated routes?
   - **Recommendation**: Include TODO comment about authentication setup

## Next Steps (Phase 1: Design)

1. **Create data-model.md**: Define structures for `SkeletonTest`, `APIRoute`, `TestCoverage`
2. **Create contracts/**: Document test generation tool interface
3. **Create quickstart.md**: Step-by-step implementation guide
4. **Update plan.md**: Fill in technical context and timeline

## Appendix: File Paths

### API Routes to Test (Absolute Paths)

```
/home/hmjn/project/web/solid-imager/src/routes/api/categories/index.ts
/home/hmjn/project/web/solid-imager/src/routes/api/categories/[id].ts
/home/hmjn/project/web/solid-imager/src/routes/api/charactors/index.ts
/home/hmjn/project/web/solid-imager/src/routes/api/charactors/[id].ts
/home/hmjn/project/web/solid-imager/src/routes/api/tags/index.ts
/home/hmjn/project/web/solid-imager/src/routes/api/tags/[id].ts
/home/hmjn/project/web/solid-imager/src/routes/api/ips/index.ts
/home/hmjn/project/web/solid-imager/src/routes/api/ips/[id].ts
/home/hmjn/project/web/solid-imager/src/routes/api/sources/[sourceId]/[mediaId]/charactors.ts
/home/hmjn/project/web/solid-imager/src/routes/api/sources/[sourceId]/[mediaId]/details.ts
/home/hmjn/project/web/solid-imager/src/routes/api/sources/[sourceId]/[mediaId]/ips.ts
/home/hmjn/project/web/solid-imager/src/routes/api/sources/[sourceId]/[mediaId]/metadata.ts
/home/hmjn/project/web/solid-imager/src/routes/api/sources/[sourceId]/[mediaId]/tags.ts
```

### Duplicate Test Files to Merge

```
/home/hmjn/project/web/solid-imager/src/tests/api/media/add-media.test.ts (keep)
/home/hmjn/project/web/solid-imager/src/tests/api/media/addMedia.test.ts (delete)
... (10 more pairs)
```

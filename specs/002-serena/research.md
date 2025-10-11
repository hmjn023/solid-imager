# Research: Function Argument Correction

**Feature**: Function Argument Correction Using Serena
**Date**: 2025-10-11
**Branch**: `002-serena`

## Executive Summary

The codebase has inconsistent function signatures and call sites, primarily stemming from:

1. **Duplicate database modules**: Both `src/db/db.ts` and `src/db/index.ts` exist with overlapping functionality but different function naming conventions
2. **Missing TypeScript compilation**: The project uses Biome for linting but TypeScript compilation errors are not being caught during development
3. **Incomplete implementations**: Many functions are stubs throwing "Not implemented" errors

## Codebase Structure

### Technology Stack

- **Framework**: SolidStart (SSR React-like framework)
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Linting/Formatting**: Biome (v2.2.4)
- **Testing**: Vitest (unit), Playwright (e2e)
- **Build Tool**: Vinxi
- **Runtime**: Node.js 22+ / Bun

### Directory Structure

```
src/
├── components/       # UI components (Solid components)
├── routes/          # SolidStart file-based routing
│   └── api/        # API endpoints
├── lib/            # Shared utilities
│   ├── api/        # API client functions
│   ├── drivers/    # Storage driver implementations
│   └── helpers/    # Utility functions
├── db/             # Database layer
│   ├── index.ts    # Main DB functions (ACTIVE)
│   ├── db.ts       # Duplicate/legacy DB functions
│   └── schema.ts   # Drizzle schema definitions
├── services/       # Business logic layer
└── tests/          # Test suites
```

## Key Findings

### 1. Duplicate Database Modules

**Problem**: Two database modules exist with conflicting function names:

- `src/db/index.ts` - Main active module with functions like:
  - `insertMediaSource()`
  - `selectMediaSourceById()`
  - `selectMediaSources()`

- `src/db/db.ts` - Legacy/duplicate module with functions like:
  - `createMediaSource()` (same as `insertMediaSource`)
  - `getMediaSourceById()` (same as `selectMediaSourceById`)
  - `getMediaSources()` (same as `selectMediaSources`)

**Impact**: API layer imports from `db/index.ts` but there's confusion about which module is authoritative.

**Example mismatch** in `src/lib/api/sources.ts:18`:
```typescript
// Imports from db/index
import {
  insertMediaSource as dbInsertMediaSource,
  // ...
} from "~/db/index";

// Later uses the imported function correctly
return dbInsertMediaSource(mediaSource);
```

### 2. Current Build Status

**Biome check output**:
- Multiple `lint/suspicious/useAwait` warnings for async functions without await
- No critical type errors reported by Biome

**TypeScript compilation** (`npx tsc --noEmit`):
- ~50+ errors, mostly from external dependencies (@kobalte, node types, drizzle-orm)
- No immediate function argument type errors in project code
- External library type mismatches (type-only imports used as values)

### 3. Incomplete Function Implementations

Many service functions are stubs with proper signatures but throw "Not implemented":

**In `src/services/media-service.ts`**:
- `searchMedia()` - stub
- `searchMediaInDirectory()` - stub
- `updateMedia()` - stub
- `getRandomMedia()` - stub
- `getRecentMedia()` - stub

**In `src/db/index.ts`** (lines 148-497):
- ~40+ placeholder functions for features 2-20
- All properly typed but throwing "Not implemented"

### 4. Function Signature Patterns

The codebase follows consistent patterns:

**Database layer** (`src/db/index.ts`):
- `select*` - Query functions
- `insert*` - Create functions
- `update*` - Update functions
- `delete*` - Delete functions

**API layer** (`src/lib/api/*.ts`):
- Imports from `~/db/index` with aliasing pattern: `insertX as dbInsertX`
- Wraps DB functions with business logic (e.g., connection testing)

**Route handlers** (`src/routes/api/**/*.ts`):
- Import from `~/lib/api/*`
- Handle HTTP request/response

### 5. TypeScript Configuration

**Current setup**:
- `tsconfig.json` exists with strict type checking
- `biome.json` configured for linting/formatting
- Build uses `npx tsc --noEmit` for type checking
- `bun run check` runs Biome checks

**Issue**: Type errors are not blocking builds or caught by pre-commit hooks

## Potential Issues Identified

### High Priority

1. **Duplicate `db.ts` file**: Should be removed or reconciled with `index.ts`
2. **Missing function argument validation**: No runtime validation via Zod schemas for most functions
3. **Type-only import errors**: External dependencies have type import issues

### Medium Priority

1. **Async/await usage**: Multiple async functions don't use await (Biome warnings)
2. **Incomplete error handling**: Many functions lack proper error boundaries
3. **Missing TypeScript strict checks in CI**: Type errors not caught before merge

### Low Priority

1. **Inconsistent naming**: `get*` vs `select*` conventions
2. **Over-parameterization**: Some functions accept `unknown` types for complex objects
3. **Missing JSDoc comments**: Function signatures lack documentation

## Serena Tool Usage Strategy

### Phase 1: Identify All Functions

Use `find_symbol` with these patterns:
- `include_kinds: [12]` (functions only) or `[6]` (methods)
- Search in `src/lib`, `src/db`, `src/services`, `src/routes/api`
- Exclude test files and external dependencies

### Phase 2: Find Call Sites

For each function found:
- Use `find_referencing_symbols` to locate all call sites
- Compare call site arguments with function signature
- Flag mismatches for fixing

### Phase 3: Fix Mismatches

Using `replace_regex` for precise fixes:
- Reorder arguments if order is wrong
- Add missing required arguments
- Remove extra arguments
- Fix type mismatches by wrapping values

### Phase 4: Remove Duplicates

- Confirm `db/db.ts` is unused
- Remove `db/db.ts` entirely
- Verify no imports reference it

## Validation Strategy

1. **Type checking**: Run `npx tsc --noEmit` after each fix batch
2. **Linting**: Run `bun run check` to verify code style
3. **Tests**: Run `bun test` to ensure no runtime breaks
4. **Build**: Run `bun run build` as final verification

## Recommended Approach

### Step 1: Clean Up Duplicates
- Remove `src/db/db.ts` (confirmed duplicate)
- Ensure all imports use `~/db/index`

### Step 2: Audit Function Signatures
- Use Serena to catalog all functions (12 functions, 6 methods)
- Document parameter types, optional parameters, defaults

### Step 3: Validate Call Sites
- For each function, find all references
- Validate argument count, order, and types
- Flag mismatches

### Step 4: Apply Fixes
- Use `replace_regex` for targeted fixes
- Work file-by-file to minimize blast radius
- Run type check after each file

### Step 5: Verification
- Run full TypeScript compilation
- Run test suite
- Run build process
- Generate fix report

## Constraints

- **Preserve formatting**: Use exact indentation from original
- **Maintain backward compatibility**: Don't change public API signatures
- **Test coverage**: Ensure existing tests still pass
- **No external library changes**: Focus on project code only

## Success Metrics

1. Zero function argument type errors in `npx tsc --noEmit`
2. Zero Biome linting errors related to function calls
3. All existing tests pass
4. Build completes successfully
5. Fix report documents all changes made

## Appendix: Key Files

### Database Layer
- `src/db/index.ts` - Primary DB functions (496 lines)
- `src/db/schema.ts` - Drizzle schema definitions
- ~~`src/db/db.ts`~~ - Duplicate, should be removed (141 lines)

### API Layer
- `src/lib/api/sources.ts` - Media source operations
- `src/lib/api/media.ts` - Media operations
- `src/lib/api/tags.ts` - Tag operations
- `src/lib/api/categories.ts` - Category operations
- `src/lib/api/characters.ts` - Character operations
- `src/lib/api/ips.ts` - IP operations

### Services
- `src/services/media-service.ts` - Media business logic
- `src/services/thumbnail-service.ts` - Thumbnail generation
- `src/services/event-service.ts` - SSE event handling

### Routes (examples)
- `src/routes/api/sources/index.ts` - Source CRUD endpoints
- `src/routes/api/sources/[sourceId]/media/[mediaId]/index.ts` - Media endpoints

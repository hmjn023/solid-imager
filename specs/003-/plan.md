# Implementation Plan: Skeleton Test Implementation

**Branch**: `003-skeleton-tests` | **Date**: 2025-10-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-/spec.md`

## Summary

This feature systematically generates skeleton test files for all untested API routes in the solid-imager codebase, standardizes test file naming to kebab-case, and merges/deletes duplicate test files. The solution uses Serena's semantic code analysis to discover routes and parse existing code patterns, combined with template-based test generation to create comprehensive test stubs with TODO markers for future implementation.

**Primary Goals**:
1. Achieve 100% API route test coverage with skeleton tests
2. Standardize all test file names to kebab-case convention
3. Merge and remove 11 duplicate test file pairs

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled
**Primary Dependencies**:
- Serena MCP Server (semantic code analysis)
- Vitest (unit/integration test framework)
- Zod (runtime schema validation)
- SolidStart (SSR framework with file-based routing)
- Biome 2.2.4 (linting/formatting)

**Storage**: N/A (in-memory processing, no persistent storage required)
**Testing**: Vitest (unit), Playwright (e2e)
**Target Platform**: Node.js 22+ / Bun runtime
**Project Type**: Single web application (SolidStart)

**Performance Goals**:
- Complete discovery in <5 seconds for 32 routes
- Generate skeleton test in <2 seconds per route
- Process all duplicates in <10 seconds
- Total workflow <5 minutes

**Constraints**:
- Must preserve exact code formatting (Biome standards)
- Cannot break existing tests (all tests must pass after changes)
- Must maintain backward compatibility (no API changes)
- All skeleton tests marked with TODO comments

**Scale/Scope**:
- 32 API route files
- 13 routes without tests (~41% coverage gap)
- 11 duplicate test file pairs (22 files)
- ~13 new test files to generate
- ~50-60 total test cases to create

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✓ PASSED

This feature is a code quality improvement (test infrastructure) that:

- ✓ Does not add new external dependencies
- ✓ Does not introduce new architectural patterns
- ✓ Maintains existing test coverage
- ✓ Uses project-standard tooling (Vitest, Zod, Biome)
- ✓ Follows existing test patterns

**No constitutional violations identified.**

The constitution file is a template (not yet populated), so no specific constraints apply.

## Project Structure

### Documentation (this feature)

```
specs/003-/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Codebase analysis
├── data-model.md        # Phase 1: Data structures
├── quickstart.md        # Phase 1: Step-by-step guide
└── contracts/           # Phase 1: Tool interfaces
    └── test-generator.md
```

### Source Code (repository root)

```
src/
├── routes/
│   └── api/             # 32 API route files
│       ├── categories/
│       │   ├── index.ts        # GET, POST
│       │   └── [id].ts         # GET, PUT, DELETE
│       ├── charactors/         # Similar CRUD
│       ├── tags/               # Similar CRUD
│       ├── ips/                # Similar CRUD
│       └── sources/
│           └── [sourceId]/
│               ├── [mediaId]/  # Media operations
│               ├── directories/ # Directory operations
│               ├── events.ts   # SSE endpoint
│               └── ...
├── lib/
│   ├── api/             # API client functions
│   ├── schemas.ts       # Zod validation schemas
│   └── ...
├── db/
│   ├── index.ts         # Database functions
│   └── schema.ts        # Drizzle schema and types
└── ...

src/tests/               # Current: 31 test files (11 duplicates)
├── api/                 # API contract tests
│   └── media/           # Only media APIs tested
│       ├── add-media.test.ts (kebab, keep)
│       ├── addMedia.test.ts (camel, delete)
│       └── ... (10 more duplicate pairs)
├── integration/         # Integration tests
│   ├── config-api.spec.ts
│   ├── media-api.spec.ts
│   └── media/           # Also has duplicates
├── unit/                # Unit tests
│   └── api/
│       └── media.test.ts
├── e2e/                 # End-to-end Playwright tests
│   ├── sources.spec.ts
│   └── thumbnails.spec.ts
└── db/
    └── index.test.ts
```

### After Implementation

```
src/tests/
├── api/                    # 100% route coverage
│   ├── categories/
│   │   ├── index.test.ts       # NEW (GET, POST tests)
│   │   └── [id].test.ts        # NEW (GET, PUT, DELETE tests)
│   ├── charactors/             # NEW directory
│   ├── tags/                   # NEW directory
│   ├── ips/                    # NEW directory
│   ├── sources/
│   │   └── [sourceId]/
│   │       ├── [mediaId]/
│   │       │   ├── charactors.test.ts  # NEW
│   │       │   ├── details.test.ts     # NEW
│   │       │   ├── ips.test.ts         # NEW
│   │       │   ├── metadata.test.ts    # NEW
│   │       │   ├── tags.test.ts        # NEW
│   │       │   └── upload.test.ts      # NEW
│   │       └── ... (more NEWs)
│   └── media/              # Clean (no duplicates)
│       ├── add-media.test.ts   # ✓ Kept
│       ├── delete-media.test.ts # ✓ Kept
│       ├── get-media.test.ts    # ✓ Kept
│       ├── list-media.test.ts   # ✓ Kept
│       └── update-media.test.ts # ✓ Kept
└── ... (other test directories cleaned)
```

**Structure Decision**: This is a single-project SolidStart web application. Test organization follows a mirror structure of `src/routes/api/` within `src/tests/api/`, with kebab-case naming enforced for all test files.

## Complexity Tracking

*No constitutional violations to justify.*

## Phase 0: Research (COMPLETED ✓)

**Output**: `research.md`

**Key Findings**:

1. **Test Coverage Gap**: 13 out of 32 API routes (41%) lack any tests
   - 8 high-priority routes (categories, characters, tags, IPs)
   - 5 medium-priority routes (media metadata operations)
   - 9 lower-priority routes (system operations, search, events)

2. **Duplicate Test Files**: 11 pairs (22 files) exist
   - All in `src/tests/api/media/` and `src/tests/integration/media/`
   - Pattern: camelCase vs kebab-case (e.g., `addMedia.test.ts` vs `add-media.test.ts`)
   - Need to diff each pair to check for unique tests before deletion

3. **Existing Test Pattern**: Clear skeleton test template found
   - Uses Vitest framework
   - Includes Zod schema validation tests
   - Has 3-test structure: happy path, validation, edge case
   - Uses TODO comments for unimplemented functionality

4. **Schemas and Types**: Partial availability
   - Some Zod schemas exist in `~/lib/schemas`
   - Entity types exported from `~/db/schema`
   - Missing schemas/types will need TODO comments

## Phase 1: Design (COMPLETED ✓)

**Outputs**:
- `data-model.md` - Defines 11 data structures (APIRoute, SkeletonTest, TestCoverage, etc.)
- `contracts/test-generator.md` - Tool interface specifications (7 phases, input/output contracts)
- `quickstart.md` - Step-by-step implementation guide

**Key Decisions**:

1. **In-Memory Processing**: No database needed, all data in memory during generation

2. **Tool Chain**:
   - Serena MCP: `find_symbol`, `get_symbols_overview`, `read_file`, `list_dir`
   - File System: Node.js/Bun fs operations for writing
   - Code Parsing: Regex/AST analysis for HTTP method extraction

3. **Template System**: String templates with placeholders for dynamic generation

4. **Naming Convention**: Enforce kebab-case for all test files

5. **Safety Measures**:
   - Check file existence before writing (no overwrite by default)
   - Backup not needed (git branch provides safety)
   - Biome formatting after generation
   - Verification test run after all changes

## Phase 2: Implementation Tasks (PENDING)

**Output**: `tasks.md` (generated by `/tasks` command)

**Task Categories** (preview):

1. **Preparation** (1-2 tasks):
   - Verify Serena active
   - Create git branch/backup

2. **Discovery** (3-4 tasks):
   - Discover all API routes
   - Parse route files for HTTP methods
   - Check test existence
   - Calculate coverage

3. **Generation** (4-5 tasks):
   - Load test template
   - Generate skeleton tests
   - Write test files
   - Format with Biome

4. **Duplicate Handling** (3-4 tasks):
   - Find duplicate pairs
   - Compare file contents
   - Merge unique tests
   - Delete camelCase files

5. **Verification & Reporting** (3-4 tasks):
   - Run test suite
   - Check for errors
   - Generate reports
   - Document results

**Note**: Detailed tasks will be generated by the `/tasks` command based on this plan.

## Implementation Phases

### Phase 0: Preparation

**Duration**: 5 minutes

**Actions**:
1. Verify Serena MCP is active: `serena status`
2. Activate solid-imager project: `serena activate solid-imager`
3. Verify git clean state: `git status`
4. Run baseline tests: `bun test > baseline-tests.txt`

**Deliverables**:
- ✓ Serena ready
- ✓ Baseline test output captured

### Phase 1: API Route Discovery

**Duration**: 5 minutes

**Actions**:
1. Find all API route files:
   ```bash
   find src/routes/api -type f -name "*.ts" ! -name "*.test.ts"
   ```
2. For each route file:
   - Read content using Serena `read_file`
   - Parse HTTP method exports (GET, POST, PUT, DELETE, PATCH)
   - Extract imported schemas from `~/lib/schemas`
   - Extract imported types from `~/db/schema`
   - Determine route pattern from file path
3. Build `APIRoute[]` collection

**Deliverables**:
- `APIRoute[]` collection (~32 items)
- Route metadata (methods, schemas, types)

### Phase 2: Test Existence Check

**Duration**: 3 minutes

**Actions**:
1. For each API route, generate expected test path:
   ```typescript
   testPath = routePath.replace('src/routes/', 'src/tests/').replace('.ts', '.test.ts')
   ```
2. Check if test file exists using Serena `read_file` (will error if not found)
3. Update `APIRoute.hasTest` and `APIRoute.testFilePath`
4. Calculate coverage metrics

**Deliverables**:
- Updated `APIRoute[]` with test status
- `TestCoverage` metrics
- List of 13 routes needing tests

### Phase 3: Skeleton Test Generation

**Duration**: 15 minutes

**Actions**:
1. For each untested route (13 routes):
   - Load test template
   - Check if Zod schema exists (add TODO if not)
   - Check if entity type exists (use fallback if not)
   - Generate describe block per HTTP method
   - Generate 3 test cases per method:
     - Happy path test
     - Validation error test
     - Edge case test
   - Render template with route metadata
   - Write test file to disk
   - Format with Biome: `biome format --write <file>`

**Deliverables**:
- 13 new test files created
- `SkeletonTest[]` collection
- Generation warnings (missing schemas/types)

### Phase 4: Duplicate Detection & Merging

**Duration**: 10 minutes

**Actions**:
1. Find all test files: `find src/tests -name "*.test.ts"`
2. Group by normalized name (remove hyphens, lowercase)
3. Identify groups with >1 file (duplicates)
4. For each duplicate pair:
   - Read both files
   - Compare contents (checksum or diff)
   - If identical: delete camelCase version
   - If different: extract unique tests from camelCase, append to kebab-case, then delete
5. Record migration in `DuplicateTestPair[]`

**Deliverables**:
- `DuplicateTestPair[]` collection (11 pairs)
- 11 camelCase files deleted
- 0-3 kebab-case files modified (if unique tests found)

### Phase 5: Verification

**Duration**: 5 minutes

**Actions**:
1. Run full test suite: `bun test --reporter=verbose`
2. Parse output:
   - Extract passed/failed/todo counts
   - Identify any new errors (compare to baseline)
3. Run type check: `bun run check`
4. Run build: `bun run build`

**Deliverables**:
- `VerifyTestsOutput` with metrics
- Test output log
- Confirmation all tests pass

### Phase 6: Report Generation

**Duration**: 5 minutes

**Actions**:
1. Calculate final metrics:
   - Routes before/after
   - Coverage before/after
   - Files created/modified/deleted
2. Generate `GenerationReport`
3. Export to JSON: `specs/003-/generation-report.json`
4. Export to Markdown: `specs/003-/generation-report.md`
5. Export duplicate migration report: `specs/003-/duplicate-migration.md`

**Deliverables**:
- 3 report files
- Summary for user

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Missing Zod schemas | High | Low | Use TODO comments, don't block generation |
| Missing entity types | Medium | Low | Use `Record<string, unknown>` as fallback |
| Duplicate files have diverged | Low | Medium | Diff and merge unique tests manually if needed |
| Test generation breaks existing tests | Very Low | High | Run verification after all changes, rollback if needed |
| File write conflicts | Very Low | Medium | Check file existence before writing, error if exists |
| Serena timeout | Low | Medium | Process routes in batches if needed |

## Success Criteria

From `spec.md`:

- [✓] **SC-001**: 100% of API routes in `src/routes/api/` have corresponding skeleton test files
- [✓] **SC-002**: All skeleton tests pass with `bun test` (using mock/placeholder implementations)
- [✓] **SC-003**: All test file names use kebab-case convention consistently
- [✓] **SC-004**: Each skeleton test includes at least 3 test cases: happy path, validation error, and one edge case
- [✓] **SC-005**: Running `bun test --reporter=verbose` shows clear TODO markers for unimplemented assertions
- [✓] **SC-006**: All duplicate test files are identified and documented in a migration report
- [✓] **SC-007**: Test organization follows the directory structure: `src/tests/{type}/{feature}/{endpoint}.test.ts`

**Acceptance**: All 7 criteria must be met for feature completion.

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 0: Preparation | 5 min | Serena ready, baseline captured |
| Phase 1: API Route Discovery | 5 min | APIRoute[] collection (~32 items) |
| Phase 2: Test Existence Check | 3 min | Test coverage metrics |
| Phase 3: Skeleton Test Generation | 15 min | 13 new test files |
| Phase 4: Duplicate Detection & Merging | 10 min | 11 duplicate pairs merged |
| Phase 5: Verification | 5 min | Test results, no new errors |
| Phase 6: Report Generation | 5 min | 3 report files |
| **Total** | **48 min** | **All artifacts + working tests** |

## Dependencies

**External**:
- Serena MCP Server must be active
- Project must be activated in Serena
- Git must be available for branch operations
- Bun must be installed for test running

**Internal**:
- Phases must execute sequentially (cannot parallelize)
- Each phase depends on previous phase outputs
- Verification gate after generation before reporting

## Open Questions

None. All requirements clarified during research and design phases.

## Progress Tracking

- [✓] Phase 0 Research: Completed 2025-10-11
- [✓] Phase 1 Design: Completed 2025-10-11
- [ ] Phase 2 Tasks: Pending (run `/tasks` command)
- [ ] Implementation: Not started
- [ ] Verification: Not started
- [ ] Reporting: Not started

## Notes

1. **Skeleton Tests Are Incomplete By Design**: All generated tests will have TODO comments marking unimplemented functionality. This is intentional - the goal is to establish the test structure, not to write full implementations.

2. **No Breaking Changes**: This feature only adds new files and removes duplicates. No existing test functionality is modified.

3. **One-Time Execution**: This is not a recurring task. It's a one-time codebase improvement to establish baseline test coverage.

4. **Manual Review Expected**: Some generated tests may need manual adjustment, especially for:
   - Routes with complex authentication
   - Routes with file uploads
   - Routes using Server-Sent Events (SSE)
   - Routes with special error handling

5. **Follow-up Work**: After skeleton generation, developers should:
   - Implement actual test logic (replace mocks with real calls)
   - Create missing Zod schemas
   - Add integration tests for complex workflows
   - Set up CI to enforce test coverage

## References

- [Feature Specification](./spec.md)
- [Research Findings](./research.md)
- [Data Model](./data-model.md)
- [Quickstart Guide](./quickstart.md)
- [Test Generator Contract](./contracts/test-generator.md)

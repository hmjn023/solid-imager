# Tasks: Reorganize src/lib and src/utils Architecture

**Input**: Design documents from `/specs/005-src-lib-utils/`
**Prerequisites**: plan.md, spec.md, quickstart.md

**Organization**: This is a refactoring task organized by migration phases. Each phase must complete and pass validation gates before proceeding to the next.

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- Use Serena MCP tools for all file operations

## Path Conventions
- Single project structure: `src/` at repository root
- All tasks use Serena tools: `find_symbol`, `find_referencing_symbols`, `create_text_file`, `replace_regex`, `execute_shell_command`

---

## Phase 1: Pre-Migration Validation & Setup

**Purpose**: Verify baseline and create directory structure

**Critical**: Do not proceed if any validation fails

- [ ] T001 Run pre-migration validation: `bun run test && bun run check && bun run lint`
- [ ] T002 Record baseline metrics (file counts, line counts, test results) per quickstart.md
- [ ] T003 Create new directory structure: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/presentation/`, `src/shared/`
- [ ] T004 Create domain subdirectories: `src/domain/{media,sources,tags,categories,characters,ips}/` and `src/domain/media/{processing,utils}/` and `src/domain/shared/`
- [ ] T005 Create infrastructure subdirectories: `src/infrastructure/{storage,api-clients,jobs,db}/`
- [ ] T006 Create application subdirectory: `src/application/services/`
- [ ] T007 Create presentation subdirectory: `src/presentation/utils/`
- [ ] T008 Create shared subdirectories: `src/shared/{types,constants}/`
- [ ] T009 Verify build still succeeds after directory creation: `bun run check`
- [ ] T010 Git checkpoint: `git add src/ && git commit -m "chore: create new directory structure for layered architecture"`

**Validation Gate**: Build must succeed before proceeding to Phase 2

---

## Phase 2: Analyze and Prepare Critical Files

**Purpose**: Understand dependencies before migration using Serena tools

**Critical Files to Analyze**:
1. `src/lib/types.ts` (28 type definitions to split)
2. `src/lib/schemas.ts` (7 validation schemas to split)
3. `src/lib/api/media.ts` (contains business logic - needs splitting)
4. `src/lib/helpers/storage-drivers.ts` (multiple drivers to split)

- [ ] T011 Use Serena `find_symbol` to list all exports from `src/lib/types.ts` and categorize by domain (media, sources, tags, categories, characters, ips, shared)
- [ ] T012 Use Serena `find_symbol` to list all exports from `src/lib/schemas.ts` and categorize by domain
- [ ] T013 Use Serena `find_referencing_symbols` to identify all imports of `src/lib/types.ts` across codebase
- [ ] T014 Use Serena `find_referencing_symbols` to identify all imports of `src/lib/schemas.ts` across codebase
- [ ] T015 Use Serena `read_file` and `get_symbols_overview` to analyze `src/lib/api/media.ts` and identify business logic vs API client functions
- [ ] T016 Use Serena `read_file` to analyze `src/lib/helpers/storage-drivers.ts` and identify individual drivers (Local, SFTP, S3, SSE)

**No git checkpoint** - this is analysis only

---

## Phase 3: Migrate Domain Layer - Types and Schemas

**Purpose**: Create domain-specific type and schema files

**Strategy**: Split types.ts and schemas.ts by domain, using Serena tools

### 3.1: Create Media Domain Types and Schemas [P]

- [ ] T017 [P] Use Serena `create_text_file` to create `src/domain/media/types.ts` with media-related types from `src/lib/types.ts` (Media, MediaMetadata, MediaSearchParams, MediaUpdateData, MediaType, etc.)
- [ ] T018 [P] Use Serena `create_text_file` to create `src/domain/media/schemas.ts` with media schemas from `src/lib/schemas.ts` (addMediaRequestSchema, updateMediaRequestSchema, mediaIdSchema, mediaTypeSchema, directoryPathSchema)

### 3.2: Create Sources Domain Types and Schemas [P]

- [ ] T019 [P] Use Serena `create_text_file` to create `src/domain/sources/types.ts` with source-related types from `src/lib/types.ts` (MediaSourceInfo, MediaSourceTypeEnum, ConnectionInfo, LocalConnectionInfo, S3Connection, SftpConnection, CloneSourceRequest, FileSystemEvent)
- [ ] T020 [P] Use Serena `create_text_file` to create `src/domain/sources/schemas.ts` with source schemas from `src/lib/schemas.ts` (sourceIdSchema, localConnectionSchema)

### 3.3: Create Tags Domain Types and Schemas [P]

- [ ] T021 [P] Use Serena `create_text_file` to create `src/domain/tags/types.ts` with tag-related types from `src/lib/types.ts` (if any - check T011 results)
- [ ] T022 [P] Use Serena `create_text_file` to create `src/domain/tags/schemas.ts` with tag schemas from `src/lib/schemas.ts` (if any - check T012 results)

### 3.4: Create Categories Domain Types and Schemas [P]

- [ ] T023 [P] Use Serena `create_text_file` to create `src/domain/categories/types.ts` with category types from `src/lib/types.ts` (CategoryData)
- [ ] T024 [P] Use Serena `create_text_file` to create `src/domain/categories/schemas.ts` (if any - check T012 results)

### 3.5: Create Characters Domain Types and Schemas [P]

- [ ] T025 [P] Use Serena `create_text_file` to create `src/domain/characters/types.ts` with character types from `src/lib/types.ts` (CharacterData)
- [ ] T026 [P] Use Serena `create_text_file` to create `src/domain/characters/schemas.ts` (if any - check T012 results)

### 3.6: Create IPs Domain Types and Schemas [P]

- [ ] T027 [P] Use Serena `create_text_file` to create `src/domain/ips/types.ts` with IP types from `src/lib/types.ts` (IpData)
- [ ] T028 [P] Use Serena `create_text_file` to create `src/domain/ips/schemas.ts` (if any - check T012 results)

### 3.7: Create Shared Domain Types [P]

- [ ] T029 [P] Use Serena `create_text_file` to create `src/domain/shared/types.ts` with cross-domain types from `src/lib/types.ts` (UUID, AppConfig, SearchOptions, ThumbnailProgress, etc.)

**Parallel Opportunity**: T017-T029 can all run in parallel (different files, no dependencies)

---

## Phase 4: Migrate Domain Layer - Processing and Utilities

**Purpose**: Move pure business logic to domain layer

### 4.1: Media Processing Files [P]

- [ ] T030 [P] Use Serena `read_file` to read `src/lib/helpers/image-processor.ts`, then `create_text_file` to create `src/domain/media/processing/image-processor.ts` (ImageProcessor, VideoProcessor, AudioProcessor, WorkflowTagExtractor exports)
- [ ] T031 [P] Use Serena `read_file` to read `src/lib/thumbnails.ts`, then `create_text_file` to create `src/domain/media/processing/thumbnail-generator.ts` (thumbnail generation logic)

### 4.2: Media Utilities [P]

- [ ] T032 [P] Use Serena `read_file` to read `src/lib/helpers/utils.ts`, extract PathUtils, then `create_text_file` to create `src/domain/media/utils/path-utils.ts`
- [ ] T033 [P] Use Serena `read_file` to read `src/lib/helpers/utils.ts`, extract HashUtils, then `create_text_file` to create `src/domain/media/utils/hash-utils.ts`

### 4.3: Shared Domain Logic [P]

- [ ] T034 [P] Use Serena `read_file` to read `src/lib/helpers/data-transformer.ts`, extract SchemaValidator, then `create_text_file` to create `src/domain/shared/validation.ts`

**Parallel Opportunity**: T030-T034 can all run in parallel

### 4.4: Validation

- [ ] T035 Verify domain layer has no infrastructure imports: `grep -r "infrastructure\|api-clients\|storage\|jobs" src/domain/` (should return nothing)
- [ ] T036 Run type check: `bun run check` (fix any errors in domain files)
- [ ] T037 Git checkpoint: `git add src/domain/ && git commit -m "refactor: migrate domain layer (types, schemas, pure functions)"`

**Validation Gate**: Type checking must pass, no infrastructure imports in domain before proceeding to Phase 5

---

## Phase 5: Migrate Infrastructure Layer - Storage Drivers

**Purpose**: Move storage abstraction to infrastructure

### 5.1: Core Storage Files [P]

- [ ] T038 [P] Use Serena `read_file` to read `src/lib/drivers/types.ts`, then `create_text_file` to create `src/infrastructure/storage/types.ts`
- [ ] T039 [P] Use Serena `read_file` to read `src/lib/drivers/factory.ts`, then `create_text_file` to create `src/infrastructure/storage/factory.ts`
- [ ] T040 [P] Use Serena `read_file` to read `src/lib/drivers/local.ts`, then `create_text_file` to create `src/infrastructure/storage/local.ts`

### 5.2: Split storage-drivers.ts into Individual Driver Files [P]

- [ ] T041 [P] Use Serena `read_file` to read `src/lib/helpers/storage-drivers.ts`, extract SftpDriver, then `create_text_file` to create `src/infrastructure/storage/sftp.ts`
- [ ] T042 [P] Use Serena `read_file` to read `src/lib/helpers/storage-drivers.ts`, extract S3Driver, then `create_text_file` to create `src/infrastructure/storage/s3.ts`

**Parallel Opportunity**: T038-T042 can all run in parallel

### 5.3: Update Storage Imports

- [ ] T043 Update `src/infrastructure/storage/factory.ts` imports to reference `src/infrastructure/storage/types.ts` and `src/infrastructure/storage/local.ts`
- [ ] T044 Update `src/infrastructure/storage/factory.ts` to import from new sftp.ts and s3.ts locations (once those exist)

---

## Phase 6: Migrate Infrastructure Layer - API Clients

**Purpose**: Move API client functions to infrastructure (separate from business logic)

**Critical**: `src/lib/api/media.ts` contains business logic - must NOT migrate business logic, only API client functions

### 6.1: Direct Migration API Clients [P]

These files are pure API clients, can be migrated directly:

- [ ] T045 [P] Use Serena `read_file` to read `src/lib/api/categories.ts`, then `create_text_file` to create `src/infrastructure/api-clients/categories.ts`
- [ ] T046 [P] Use Serena `read_file` to read `src/lib/api/characters.ts`, then `create_text_file` to create `src/infrastructure/api-clients/characters.ts`
- [ ] T047 [P] Use Serena `read_file` to read `src/lib/api/config.ts`, then `create_text_file` to create `src/infrastructure/api-clients/config.ts`
- [ ] T048 [P] Use Serena `read_file` to read `src/lib/api/directories.ts`, then `create_text_file` to create `src/infrastructure/api-clients/directories.ts`
- [ ] T049 [P] Use Serena `read_file` to read `src/lib/api/events.ts`, then `create_text_file` to create `src/infrastructure/api-clients/events.ts`
- [ ] T050 [P] Use Serena `read_file` to read `src/lib/api/ips.ts`, then `create_text_file` to create `src/infrastructure/api-clients/ips.ts`
- [ ] T051 [P] Use Serena `read_file` to read `src/lib/api/sources.ts`, then `create_text_file` to create `src/infrastructure/api-clients/sources.ts`
- [ ] T052 [P] Use Serena `read_file` to read `src/lib/api/tags.ts`, then `create_text_file` to create `src/infrastructure/api-clients/tags.ts`
- [ ] T053 [P] Use Serena `read_file` to read `src/lib/api/thumbnails.ts`, then `create_text_file` to create `src/infrastructure/api-clients/thumbnails.ts`

**Parallel Opportunity**: T045-T053 can all run in parallel

### 6.2: Handle media.ts Special Case

**Critical**: Based on T015 analysis, separate API client functions from business logic

- [ ] T054 Analyze `src/lib/api/media.ts` using T015 results to identify API client functions vs business logic
- [ ] T055 Use Serena `create_text_file` to create `src/infrastructure/api-clients/media.ts` with ONLY API client functions (e.g., functions that call routes/endpoints)
- [ ] T056 Note: Business logic from `src/lib/api/media.ts` should already exist in `src/services/media-service.ts` - DO NOT duplicate, verify this

---

## Phase 7: Migrate Infrastructure Layer - Jobs and Database

**Purpose**: Move background jobs and database to infrastructure

### 7.1: Jobs [P]

- [ ] T057 [P] Use Serena `read_file` to read `src/lib/helpers/job-queue.ts`, extract JobQueue, then `create_text_file` to create `src/infrastructure/jobs/job-queue.ts`
- [ ] T058 [P] Use Serena `read_file` to read `src/lib/helpers/job-queue.ts`, extract SseManager, then `create_text_file` to create `src/infrastructure/jobs/sse-manager.ts`
- [ ] T059 [P] Use Serena `read_file` to read `src/services/thumbnail-jobs.ts`, then `create_text_file` to create `src/infrastructure/jobs/thumbnail-jobs.ts`

### 7.2: Database [P]

- [ ] T060 [P] Use Serena `read_file` to read `src/db/index.ts`, then `create_text_file` to create `src/infrastructure/db/index.ts`
- [ ] T061 [P] Use Serena `read_file` to read `src/db/schema.ts`, then `create_text_file` to create `src/infrastructure/db/schema.ts`

**Parallel Opportunity**: T057-T061 can all run in parallel

### 7.3: Validation

- [ ] T062 Verify infrastructure does not import application: `grep -r "application/services" src/infrastructure/` (should return nothing)
- [ ] T063 Run type check: `bun run check` (fix any errors in infrastructure files)
- [ ] T064 Run integration tests: `bun run test:integration` (if tests exist, otherwise run `bun run test`)
- [ ] T065 Git checkpoint: `git add src/infrastructure/ && git commit -m "refactor: migrate infrastructure layer (storage, API clients, jobs, db)"`

**Validation Gate**: Type checking and integration tests must pass before proceeding to Phase 8

---

## Phase 8: Migrate Application Layer - Services

**Purpose**: Move services from src/services/ to src/application/services/

**Strategy**: These files are already well-organized, just need to move them

### 8.1: Move Service Files

**Note**: Use git mv or shell commands for simple moves, as files don't need content changes (only import updates later)

- [ ] T066 Use Serena `execute_shell_command` to move all service files: `git mv src/services/analytics-service.ts src/application/services/analytics-service.ts`
- [ ] T067 Use Serena `execute_shell_command`: `git mv src/services/bulk-operation-service.ts src/application/services/bulk-operation-service.ts`
- [ ] T068 Use Serena `execute_shell_command`: `git mv src/services/category-service.ts src/application/services/category-service.ts`
- [ ] T069 Use Serena `execute_shell_command`: `git mv src/services/character-service.ts src/application/services/character-service.ts`
- [ ] T070 Use Serena `execute_shell_command`: `git mv src/services/collection-service.ts src/application/services/collection-service.ts`
- [ ] T071 Use Serena `execute_shell_command`: `git mv src/services/config-service.ts src/application/services/config-service.ts`
- [ ] T072 Use Serena `execute_shell_command`: `git mv src/services/data-migration-service.ts src/application/services/data-migration-service.ts`
- [ ] T073 Use Serena `execute_shell_command`: `git mv src/services/directory-service.ts src/application/services/directory-service.ts`
- [ ] T074 Use Serena `execute_shell_command`: `git mv src/services/event-service.ts src/application/services/event-service.ts`
- [ ] T075 Use Serena `execute_shell_command`: `git mv src/services/filter-preset-service.ts src/application/services/filter-preset-service.ts`
- [ ] T076 Use Serena `execute_shell_command`: `git mv src/services/index.ts src/application/services/index.ts`
- [ ] T077 Use Serena `execute_shell_command`: `git mv src/services/integration-service.ts src/application/services/integration-service.ts`
- [ ] T078 Use Serena `execute_shell_command`: `git mv src/services/ip-service.ts src/application/services/ip-service.ts`
- [ ] T079 Use Serena `execute_shell_command`: `git mv src/services/media-service.ts src/application/services/media-service.ts`
- [ ] T080 Use Serena `execute_shell_command`: `git mv src/services/media-source-service.ts src/application/services/media-source-service.ts`
- [ ] T081 Use Serena `execute_shell_command`: `git mv src/services/search-service.ts src/application/services/search-service.ts`
- [ ] T082 Use Serena `execute_shell_command`: `git mv src/services/thumbnail-service.ts src/application/services/thumbnail-service.ts`
- [ ] T083 Use Serena `execute_shell_command`: `git mv src/services/user-service.ts src/application/services/user-service.ts`
- [ ] T084 Use Serena `execute_shell_command`: `git mv src/services/workflow-service.ts src/application/services/workflow-service.ts`

**Note**: thumbnail-jobs.ts already moved to infrastructure in T059, so skip it here

### 8.2: Validation

- [ ] T085 Verify src/services/ is now empty: `ls src/services/` (should show no files)
- [ ] T086 Run type check: `bun run check` (will show import errors - that's expected, we'll fix in Phase 10)
- [ ] T087 Git checkpoint: `git add src/application/services/ src/services/ && git commit -m "refactor: migrate application layer (services)"`

**Validation Gate**: Services moved, expect import errors (fixed in Phase 10)

---

## Phase 9: Migrate Presentation Layer - Utilities

**Purpose**: Move presentation-specific utilities

### 9.1: Create Presentation Utilities

- [ ] T088 Use Serena `read_file` to read `src/lib/utils.ts` (contains single `cn()` utility), then `create_text_file` to create `src/presentation/utils/cn.ts`

### 9.2: Validation

- [ ] T089 Run type check: `bun run check` (will show import errors - expected, fixed in Phase 10)
- [ ] T090 Git checkpoint: `git add src/presentation/ && git commit -m "refactor: migrate presentation layer utilities"`

**Validation Gate**: Presentation utilities migrated, expect import errors (fixed next)

---

## Phase 10: Update All Imports Across Codebase

**Purpose**: Update import statements to reference new paths

**Strategy**: Use Serena `replace_regex` for bulk import updates, use TypeScript compiler to find missed imports

### 10.1: Update Imports - Domain Types and Schemas

**Pattern**: `~/lib/types` → domain-specific paths

- [ ] T091 Use Serena `find_referencing_symbols` to find all files importing from `~/lib/types` (from T013 results)
- [ ] T092 For each file found in T091, use Serena `replace_regex` to update imports:
  - `from "~/lib/types"` → `from "~/domain/{media|sources|tags|categories|characters|ips|shared}/types"`
  - Match import specifiers to determine correct domain (e.g., `MediaMetadata` → `~/domain/media/types`)
- [ ] T093 Use Serena `find_referencing_symbols` to find all files importing from `~/lib/schemas` (from T014 results)
- [ ] T094 For each file found in T093, use Serena `replace_regex` to update imports:
  - `from "~/lib/schemas"` → `from "~/domain/{media|sources|tags|categories|characters|ips}/schemas"`

### 10.2: Update Imports - Domain Processing and Utils

- [ ] T095 Use Serena `replace_regex` to update all imports: `from "~/lib/helpers/image-processor"` → `from "~/domain/media/processing/image-processor"`
- [ ] T096 Use Serena `replace_regex` to update all imports: `from "~/lib/thumbnails"` → `from "~/domain/media/processing/thumbnail-generator"`
- [ ] T097 Use Serena `replace_regex` to update all imports: `from "~/lib/helpers/utils"` → `from "~/domain/media/utils/{path-utils|hash-utils}"` (based on what's imported)
- [ ] T098 Use Serena `replace_regex` to update all imports: `from "~/lib/helpers/data-transformer"` → `from "~/domain/shared/validation"`

### 10.3: Update Imports - Infrastructure

- [ ] T099 Use Serena `replace_regex` to update all imports: `from "~/lib/drivers/*"` → `from "~/infrastructure/storage/*"`
- [ ] T100 Use Serena `replace_regex` to update all imports: `from "~/lib/api/*"` → `from "~/infrastructure/api-clients/*"`
- [ ] T101 Use Serena `replace_regex` to update all imports: `from "~/lib/helpers/job-queue"` → `from "~/infrastructure/jobs/{job-queue|sse-manager}"` (based on what's imported)
- [ ] T102 Use Serena `replace_regex` to update all imports: `from "~/db"` → `from "~/infrastructure/db"`

### 10.4: Update Imports - Application Services

- [ ] T103 Use Serena `replace_regex` to update all imports: `from "~/services/*"` → `from "~/application/services/*"`

### 10.5: Update Imports - Presentation

- [ ] T104 Use Serena `replace_regex` to update all imports: `from "~/lib/utils"` → `from "~/presentation/utils/cn"` (only for cn() utility)

### 10.6: Update Service Internal Imports

**Services now in application/services/ need their imports updated to reference new domain/infrastructure paths**

- [ ] T105 For each file in `src/application/services/`, use Serena `read_file` and `replace_regex` to update their imports:
  - `~/lib/types` → `~/domain/*/types`
  - `~/lib/schemas` → `~/domain/*/schemas`
  - `~/lib/*` → appropriate new path
  - `~/db` → `~/infrastructure/db`
  - `~/services/*` → `~/application/services/*` (for internal service references)

### 10.7: Validation

- [ ] T106 Run type check to find any missed imports: `bun run check`
- [ ] T107 Fix any remaining import errors identified in T106 using Serena `replace_regex`
- [ ] T108 Verify no old import paths remain: `grep -r "from.*~/lib/" src/ --exclude-dir=node_modules` (should return nothing)
- [ ] T109 Verify no old service imports remain: `grep -r 'from "~/services/' src/ --exclude-dir=application` (should return nothing)
- [ ] T110 Verify no old db imports remain: `grep -r 'from "~/db"' src/ --exclude-dir=infrastructure` (should return nothing)
- [ ] T111 Run full test suite: `bun run test`
- [ ] T112 Git checkpoint: `git add -A && git commit -m "refactor: update all imports to new architecture paths"`

**Validation Gate**: Zero import errors, all tests pass before proceeding to Phase 11

---

## Phase 11: Update Test Imports

**Purpose**: Update test files to import from new paths

**Estimate**: ~80+ test files need import updates

### 11.1: Update Test Imports by Category

- [ ] T113 Use Serena `find_referencing_symbols` to find all test files in `src/tests/` importing old paths
- [ ] T114 For each test file, use Serena `replace_regex` to update imports same as Phase 10 (types, schemas, services, db, etc.)
- [ ] T115 Special attention to `src/tests/unit/api/media.test.ts` - update to import from infrastructure/api-clients or domain as appropriate
- [ ] T116 Update `src/tests/integration/` files to use `~/application/services/` and `~/infrastructure/db/`
- [ ] T117 Update `src/tests/api/` files to use new domain/infrastructure paths

### 11.2: Validation

- [ ] T118 Run type check: `bun run check`
- [ ] T119 Run unit tests: `bun run test:unit` (or `bun run test src/tests/unit/`)
- [ ] T120 Run integration tests: `bun run test:integration` (or `bun run test src/tests/integration/`)
- [ ] T121 Run API tests: `bun run test src/tests/api/`
- [ ] T122 Run full test suite: `bun run test`
- [ ] T123 Verify all tests pass (100% pass rate)
- [ ] T124 Git checkpoint: `git add src/tests/ && git commit -m "refactor: update test imports to new architecture paths"`

**Validation Gate**: All tests must pass (100%) before proceeding to Phase 12

---

## Phase 12: Clean Up Old Directories

**Purpose**: Remove old directory structure after verifying all imports updated

**Critical**: Only proceed if Phase 11 validation passed (100% tests passing)

### 12.1: Final Verification Before Deletion

- [ ] T125 Verify NO references to old paths remain: `grep -r "~/lib/\|~/services/\|~/db" src/ --exclude-dir=node_modules --exclude-dir=domain --exclude-dir=application --exclude-dir=infrastructure --exclude-dir=presentation --exclude-dir=shared` (should return NOTHING)
- [ ] T126 Verify all tests still pass: `bun run test`
- [ ] T127 Verify type checking passes: `bun run check`

### 12.2: Remove Old Directories

**CRITICAL: Only execute if T125-T127 show zero errors**

- [ ] T128 Use Serena `execute_shell_command` to remove old lib directory: `git rm -r src/lib/`
- [ ] T129 Use Serena `execute_shell_command` to remove old services directory (should be empty): `git rm -r src/services/`
- [ ] T130 Use Serena `execute_shell_command` to remove empty utils directory: `git rm -r src/utils/`
- [ ] T131 Use Serena `execute_shell_command` to remove old db directory: `git rm -r src/db/`

### 12.3: Validation

- [ ] T132 Verify old directories removed: `ls src/` (should show domain, application, infrastructure, presentation, shared, routes, components, tests, app.tsx, etc. - NO lib, services, utils, db)
- [ ] T133 Run full validation suite: `bun run check && bun run lint && bun run test`
- [ ] T134 Run build: `bun run build`
- [ ] T135 Git checkpoint: `git add -A && git commit -m "refactor: remove old directory structure after migration"`

**Validation Gate**: All validation must pass (check, lint, test, build) before proceeding to Phase 13

---

## Phase 13: Architecture Verification

**Purpose**: Verify architectural constraints and document new structure

### 13.1: Verify Architectural Boundaries

- [ ] T136 Verify domain layer purity (no infrastructure imports): `grep -r "infrastructure\|application/services" src/domain/ && echo "❌ VIOLATION" || echo "✓ Pass"`
- [ ] T137 Verify infrastructure independence (no application imports): `grep -r "application/services" src/infrastructure/ && echo "❌ VIOLATION" || echo "✓ Pass"`
- [ ] T138 Verify dependency direction: domain ← infrastructure, domain ← application, no circular dependencies
- [ ] T139 Generate dependency graph (optional): Use tool or manual inspection to verify clean architecture layers

### 13.2: Measure Success Metrics

- [ ] T140 Count files in each layer: `find src/{domain,application,infrastructure,presentation} -type f | wc -l`
- [ ] T141 Measure code duplication reduction: Compare line counts of duplicate logic before/after (target: 20% reduction)
- [ ] T142 Verify 4 architectural layers exist: `ls -d src/*/` (should show domain, application, infrastructure, presentation + shared)
- [ ] T143 Run final test suite and record 100% pass rate: `bun run test`
- [ ] T144 Run type checking and record zero errors: `bun run check`

### 13.3: Create Architecture Documentation

- [ ] T145 Create `docs/architecture/ARCHITECTURE.md` documenting new structure, layer responsibilities, and guidelines for adding new code
- [ ] T146 Update main README.md with link to new architecture documentation
- [ ] T147 Create Architecture Decision Record (ADR) documenting rationale for this refactoring

### 13.4: Final Git Checkpoint

- [ ] T148 Git checkpoint: `git add docs/ README.md && git commit -m "docs: add architecture documentation and ADR for layered refactoring"`

---

## Phase 14: Polish & Final Validation

**Purpose**: Final cleanup and validation against all success criteria

### 14.1: Code Quality

- [ ] T149 Run linter and fix any issues: `bun run lint --fix`
- [ ] T150 Run formatter and fix formatting: `bun run format` (if separate from lint)
- [ ] T151 Review for any remaining TODO comments or cleanup needed in migrated files

### 14.2: Run Complete Validation (from quickstart.md)

- [ ] T152 Execute post-migration validation from quickstart.md:
  - `bun run check` (type checking)
  - `bun run lint` (linting)
  - `bun run test:unit` (unit tests)
  - `bun run test:integration` (integration tests)
  - `bun run test:e2e` (e2e tests)
  - `bun run build` (build)

### 14.3: Verify Success Criteria (from spec.md)

- [ ] T153 **SC-001**: Verify 4 architectural layers exist (domain, application, infrastructure, presentation)
- [ ] T154 **SC-002**: Verify zero compilation errors
- [ ] T155 **SC-003**: Verify 100% test pass rate
- [ ] T156 **SC-004**: Verify developer can navigate structure intuitively (peer review or self-assessment)
- [ ] T157 **SC-005**: Verify zero cross-layer violations (from T136-T138)
- [ ] T158 **SC-006**: Verify code duplication reduced by 20%+ (from T141)
- [ ] T159 **SC-007**: Verify architecture documentation exists (from T145-T147)

### 14.4: Final Commit

- [ ] T160 Final git checkpoint: `git add -A && git commit -m "refactor: complete src/lib and src/utils architecture reorganization

- Established Clean Architecture / Hexagonal Architecture with 4 layers
- Domain: business logic, pure functions (no I/O)
- Application: service orchestration, use cases
- Infrastructure: I/O, drivers, API clients, jobs, DB
- Presentation: UI utilities, routes, components

Metrics:
- Zero compilation errors ✓
- 100% test pass rate ✓
- 4 architectural layers ✓
- Zero cross-layer violations ✓
- Code duplication reduced 20%+ ✓
- Architecture docs created ✓

All existing functionality preserved, only structure changed."`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: Setup - No dependencies, start immediately
- **Phase 2**: Analysis - Depends on Phase 1 (directories created)
- **Phase 3-9**: Migration phases - Sequential, each depends on previous phase validation passing
- **Phase 10**: Import updates - Depends on Phases 3-9 (all files migrated)
- **Phase 11**: Test imports - Depends on Phase 10 (source imports fixed)
- **Phase 12**: Cleanup - Depends on Phase 11 (all tests passing)
- **Phase 13**: Architecture verification - Depends on Phase 12 (cleanup complete)
- **Phase 14**: Polish - Depends on Phase 13 (architecture verified)

### Parallel Opportunities Within Phases

**Phase 3**: T017-T029 (all domain type/schema files) can run in parallel
**Phase 4**: T030-T034 (all processing/utility files) can run in parallel
**Phase 5**: T038-T042 (all storage driver files) can run in parallel
**Phase 6**: T045-T053 (all API client files except media.ts) can run in parallel
**Phase 7**: T057-T061 (jobs and db files) can run in parallel

**Cannot parallelize**: Phases are sequential, import updates must happen after all files migrated

### Critical Path

1. Setup (Phase 1) → Analysis (Phase 2) → Domain migration (Phases 3-4) → Infrastructure migration (Phases 5-7) → Application migration (Phase 8) → Presentation migration (Phase 9) → Import updates (Phase 10) → Test import updates (Phase 11) → Cleanup (Phase 12) → Verification (Phase 13) → Polish (Phase 14)

---

## Validation Gates Summary

Must pass before proceeding to next phase:

- **After Phase 1**: Build succeeds with new directories
- **After Phase 4**: Type checking passes, no infrastructure imports in domain
- **After Phase 7**: Type checking and integration tests pass, no application imports in infrastructure
- **After Phase 10**: Zero import errors, all tests pass
- **After Phase 11**: 100% test pass rate
- **After Phase 12**: All validation passes (check, lint, test, build)

---

## Rollback Strategy

If any validation gate fails:

1. Review error messages from validation step
2. Use `git log --oneline -10` to see recent commits
3. Use `git reset --hard <last-good-checkpoint>` to rollback
4. Fix identified issues in isolation
5. Re-attempt the failed phase
6. Do not proceed until validation passes

---

## Parallel Example: Domain Types (Phase 3)

```bash
# All these tasks can run together (different files, no dependencies):
Task: "Create src/domain/media/types.ts with media types"
Task: "Create src/domain/media/schemas.ts with media schemas"
Task: "Create src/domain/sources/types.ts with source types"
Task: "Create src/domain/sources/schemas.ts with source schemas"
Task: "Create src/domain/tags/types.ts with tag types"
Task: "Create src/domain/tags/schemas.ts with tag schemas"
Task: "Create src/domain/categories/types.ts with category types"
Task: "Create src/domain/characters/types.ts with character types"
Task: "Create src/domain/ips/types.ts with IP types"
Task: "Create src/domain/shared/types.ts with cross-domain types"
```

---

## Implementation Strategy

### Incremental Migration Approach

1. **Complete Phase 1**: Setup directories
2. **Complete Phase 2**: Analyze dependencies (critical for planning)
3. **Complete Phases 3-9**: Migrate files layer by layer, validating after each layer
4. **Complete Phase 10-11**: Update all imports (source then tests)
5. **Complete Phase 12**: Clean up only after 100% tests pass
6. **Complete Phase 13-14**: Verify architecture and polish
7. **Each phase has a git checkpoint** - can rollback to any phase if issues arise

### Key Principles

- **Safety first**: Incremental with validation gates
- **Use Serena exclusively**: All file operations via MCP tools
- **Test continuously**: Run tests after each layer migration
- **Git checkpoints**: Commit after each major phase for easy rollback
- **No parallel phases**: Phases are sequential, but tasks within phases can be parallel

---

## Notes

- [P] tasks = different files, no dependencies within that phase
- All file operations use Serena MCP tools
- Each phase ends with validation before proceeding
- Phases are sequential (cannot parallelize phases), but tasks within phases can run in parallel
- No functionality changes - pure refactoring, validated by test pass/fail
- Target: 6-8 hours total effort (single developer, sequential execution)
- Import updates (Phase 10-11) are the most time-consuming due to ~150+ import statements
- Critical files (types.ts, schemas.ts, media.ts) require careful splitting before migration

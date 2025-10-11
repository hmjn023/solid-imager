# Feature Specification: Reorganize src/lib and src/utils Architecture

**Feature Branch**: `005-src-lib-utils`
**Created**: 2025-10-11
**Status**: Draft
**Input**: User description: "./src 下、特にlibとutilsを役割に即した配置に変更して
モダンなアーキテクチャに沿った形にしたい
その際内容を統合・分離したほうがいい場合はしても構わない
serenaを使うこと"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Navigates Codebase Intuitively (Priority: P1)

As a developer working on this codebase, I need to quickly find where specific functionality lives without having to search through multiple directories or guess at file locations. The directory structure should follow modern architectural patterns where the purpose of each directory is immediately clear from its name and location.

**Why this priority**: This is the foundation for all other improvements. If developers cannot navigate the codebase efficiently, all other architectural benefits are diminished. This directly impacts development velocity and code maintainability.

**Independent Test**: Can be fully tested by having a developer (or the team) locate common functionality types (e.g., "where do I find media processing?", "where are API client functions?", "where is business logic?") and measuring time-to-find and accuracy. Success means <30 seconds to locate any major functionality category.

**Acceptance Scenarios**:

1. **Given** a developer needs to modify image thumbnail generation logic, **When** they look at the src directory structure, **Then** they can immediately identify this belongs in `src/core/media/` or `src/domain/media/processing/` without searching
2. **Given** a developer needs to add a new API endpoint, **When** they examine the codebase, **Then** they can clearly distinguish between API client code (calling external APIs) and API route handlers (serving requests)
3. **Given** a developer needs to understand storage abstraction, **When** they navigate the directory structure, **Then** infrastructure concerns (drivers, storage) are clearly separated from business logic (services, domain)

---

### User Story 2 - Clear Separation of Concerns (Priority: P1)

As a developer adding new features, I need the codebase to follow the principle of separation of concerns so that changes in one layer (e.g., switching from local storage to S3) don't cascade into unrelated parts of the system (e.g., business logic or API routes).

**Why this priority**: This is critical for maintainability and testability. Without clear separation, the codebase becomes tightly coupled, making changes risky and time-consuming. This must be addressed before adding more features.

**Independent Test**: Can be tested by attempting a specific change (e.g., "switch storage driver from local to S3") and verifying that only infrastructure layer files need modification, with zero changes required in business logic or route handlers.

**Acceptance Scenarios**:

1. **Given** the storage driver implementation needs to change, **When** implementing a new driver (e.g., SFTP), **Then** no changes are required in services or domain logic that use the storage abstraction
2. **Given** business logic needs to validate media metadata, **When** examining the code, **Then** validation logic is in domain/business layer, not mixed with infrastructure (API clients) or presentation (routes)
3. **Given** a developer is writing unit tests for media processing, **When** they examine dependencies, **Then** they can easily mock infrastructure dependencies because they're clearly separated

---

### User Story 3 - Eliminate Code Duplication and Consolidate Related Functionality (Priority: P2)

As a developer maintaining the codebase, I need similar functionality to be consolidated in a single location rather than scattered across multiple files with overlapping responsibilities, so that bug fixes and enhancements only need to be made once.

**Why this priority**: Currently there's duplication between `src/lib/api/media.ts` (which contains business logic), `src/services/media-service.ts`, `src/lib/helpers/`, and scattered utilities. This leads to inconsistency and maintenance burden. However, this can be addressed after establishing the new structure (P1).

**Independent Test**: Can be tested by searching for duplicate or overlapping functionality (e.g., "how many places handle media thumbnail generation?") and verifying there's a single source of truth for each concern after refactoring.

**Acceptance Scenarios**:

1. **Given** thumbnail generation logic exists in multiple places, **When** consolidating to the new structure, **Then** there is exactly one module responsible for thumbnail generation (in domain/core layer)
2. **Given** API client functions for calling routes exist alongside route handlers, **When** reorganizing, **Then** API clients are clearly separated from API route handlers
3. **Given** utility functions are scattered across `lib/utils.ts`, `lib/helpers/utils.ts`, and other locations, **When** consolidating, **Then** utilities are organized by domain (e.g., path utils, hash utils) in appropriate locations

---

### User Story 4 - Modern TypeScript/JavaScript Architecture Patterns (Priority: P2)

As a developer familiar with modern JavaScript/TypeScript architectures (Clean Architecture, Hexagonal Architecture, DDD-lite), I want the codebase to follow recognizable patterns so that I can leverage my existing knowledge and the codebase remains maintainable as it scales.

**Why this priority**: Following established patterns makes the codebase more approachable for new developers and provides a clear mental model for where new code belongs. This is important but secondary to establishing basic separation of concerns.

**Independent Test**: Can be tested by presenting the new directory structure to developers familiar with modern architecture patterns and asking them to identify the architectural style and locate where specific types of code belong (e.g., "where does business logic go?", "where are infrastructure adapters?").

**Acceptance Scenarios**:

1. **Given** the new directory structure, **When** a developer familiar with Clean Architecture reviews it, **Then** they can identify domain/core, application/services, infrastructure, and presentation layers
2. **Given** new functionality needs to be added, **When** a developer examines the structure, **Then** it's clear whether code belongs in domain, application, infrastructure, or presentation layer
3. **Given** the codebase uses dependency injection patterns, **When** examining service dependencies, **Then** high-level modules (domain) do not depend on low-level modules (infrastructure), but both depend on abstractions

---

### Edge Cases

- What happens when migrating imports during the reorganization? All import paths must be updated, and the build must remain functional at each step
- How do we handle files that have mixed concerns (e.g., `lib/api/media.ts` contains both API client code and business logic)? These must be carefully split into appropriate layers
- What if some helper functions are truly cross-cutting (used by multiple layers)? These should go in a `src/shared/` or `src/common/` directory with clear documentation
- How do we handle the empty `src/utils/` directory? It should be removed if truly empty, or repurposed if there's a clear need
- What happens to existing tests during the migration? Test imports must be updated, but test logic should remain unchanged (tests should still pass)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST reorganize `src/lib/` into layers following modern architecture patterns (domain/core, application/services, infrastructure)
- **FR-002**: System MUST consolidate `src/lib/api/` into API client functions (infrastructure layer) separate from business logic
- **FR-003**: System MUST move storage drivers (`src/lib/drivers/`) to an infrastructure layer (`src/infrastructure/storage/` or `src/adapters/storage/`)
- **FR-004**: System MUST consolidate helper functions from `src/lib/helpers/` into appropriate domain or infrastructure modules based on their responsibilities
- **FR-005**: System MUST create clear separation between:
  - Domain/Business Logic (pure functions, business rules, domain models)
  - Application Services (orchestration, use cases)
  - Infrastructure (storage drivers, external API clients, I/O operations)
  - Presentation (API routes, UI components)
- **FR-006**: System MUST move or consolidate `src/lib/utils.ts` (currently only contains `cn()` utility) into appropriate location (likely `src/shared/ui/` or `src/presentation/utils/`)
- **FR-007**: System MUST resolve the empty `src/utils/` directory (remove or repurpose with clear guidelines)
- **FR-008**: System MUST ensure all import paths are updated throughout the codebase (`src/routes/`, `src/services/`, `src/components/`, tests)
- **FR-009**: System MUST maintain backward compatibility during migration (all existing tests must continue to pass)
- **FR-010**: System MUST consolidate overlapping functionality (e.g., `src/lib/api/media.ts` contains business logic that overlaps with `src/services/media-service.ts`)
- **FR-011**: System MUST organize type definitions (`src/lib/types.ts`) and schemas (`src/lib/schemas.ts`) by domain (e.g., media types, source types, tag types)
- **FR-012**: System MUST create clear guidelines/documentation for where new code should be placed in the new structure

### Key Entities *(include if feature involves data)*

- **Domain Layer**: Contains business logic, domain models, and business rules. Pure functions with no I/O dependencies
  - Examples: Media processing rules, validation logic, business calculations
  - Current locations: Parts of `src/lib/api/media.ts`, parts of `src/lib/helpers/`, `src/lib/thumbnails.ts`

- **Application/Services Layer**: Contains use case orchestration and application services
  - Examples: MediaService, ThumbnailService, DirectoryService
  - Current locations: `src/services/` (already well-organized)

- **Infrastructure Layer**: Contains I/O operations, external integrations, storage drivers, API clients
  - Examples: Storage drivers (local, S3, SFTP), API clients, database access, file system operations
  - Current locations: `src/lib/drivers/`, `src/lib/api/` (API clients), parts of `src/lib/helpers/`

- **Shared/Common**: Cross-cutting utilities and types used across multiple layers
  - Examples: Type definitions, shared utilities, constants
  - Current locations: `src/lib/types.ts`, `src/lib/schemas.ts`, `src/lib/utils.ts`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All files from `src/lib/` are reorganized into a clear layered architecture with no more than 3-4 top-level directories representing architectural layers
- **SC-002**: Zero compilation errors after reorganization (all import paths correctly updated)
- **SC-003**: 100% of existing tests continue to pass without modification to test logic (only import paths updated)
- **SC-004**: Developer survey shows >80% can correctly identify where new code belongs (e.g., "where should I put a new storage driver?", "where does media processing logic go?")
- **SC-005**: Code review shows zero instances of cross-layer violations (e.g., domain layer does not import from infrastructure layer)
- **SC-006**: Reduce code duplication: consolidated overlapping functionality reduces total lines of code in affected files by at least 20%
- **SC-007**: Documentation exists (README or ADR) explaining the new architecture and guidelines for placing new code

## Proposed Architecture Structure

Based on modern TypeScript/JavaScript architecture patterns and the current codebase, here's the proposed structure:

```
src/
├── domain/              # Business logic, domain models, pure functions
│   ├── media/
│   │   ├── types.ts     # Media-related types (from lib/types.ts)
│   │   ├── schemas.ts   # Media validation schemas (from lib/schemas.ts)
│   │   ├── processing/  # Image/video/audio processing logic
│   │   │   ├── image-processor.ts    (from lib/helpers/image-processor.ts)
│   │   │   └── thumbnail-generator.ts (from lib/thumbnails.ts)
│   │   └── utils/       # Media-specific utilities
│   │       ├── path-utils.ts  (from lib/helpers/utils.ts - PathUtils)
│   │       └── hash-utils.ts  (from lib/helpers/utils.ts - HashUtils)
│   ├── sources/
│   │   ├── types.ts     # Source-related types
│   │   └── schemas.ts   # Source validation schemas
│   ├── tags/
│   │   ├── types.ts
│   │   └── schemas.ts
│   ├── categories/
│   │   ├── types.ts
│   │   └── schemas.ts
│   └── shared/          # Cross-domain business logic
│       └── validation.ts (from lib/helpers/data-transformer.ts - SchemaValidator)
│
├── application/         # Use cases, service orchestration
│   └── services/        # Application services (current src/services/)
│       ├── media-service.ts
│       ├── thumbnail-service.ts
│       ├── directory-service.ts
│       ├── category-service.ts
│       ├── character-service.ts
│       ├── ip-service.ts
│       └── ...
│
├── infrastructure/      # External integrations, I/O, drivers
│   ├── storage/         # Storage drivers (from lib/drivers/)
│   │   ├── types.ts     (from lib/drivers/types.ts)
│   │   ├── factory.ts   (from lib/drivers/factory.ts)
│   │   ├── local.ts     (from lib/drivers/local.ts)
│   │   ├── sftp.ts      (from lib/helpers/storage-drivers.ts - SftpDriver)
│   │   └── s3.ts        (from lib/helpers/storage-drivers.ts - S3Driver)
│   ├── api-clients/     # API client functions (from lib/api/)
│   │   ├── categories.ts
│   │   ├── characters.ts
│   │   ├── media.ts     (API client parts only)
│   │   ├── sources.ts
│   │   └── ...
│   ├── jobs/            # Background job processing
│   │   ├── job-queue.ts (from lib/helpers/job-queue.ts)
│   │   └── thumbnail-jobs.ts (from services/thumbnail-jobs.ts)
│   └── db/              # Database access (already well-placed)
│       ├── index.ts
│       └── schema.ts
│
├── presentation/        # UI, routes, components
│   ├── routes/          # API route handlers (current src/routes/)
│   │   └── ...
│   ├── components/      # UI components (current src/components/)
│   │   └── ...
│   └── utils/           # Presentation-specific utilities
│       └── cn.ts        (from lib/utils.ts)
│
├── shared/              # True cross-cutting concerns
│   ├── types/           # Shared type definitions
│   │   └── common.ts
│   └── constants/
│
├── tests/               # Tests (current structure maintained)
│   └── ...
│
├── app.tsx
├── app.css
├── entry-client.tsx
├── entry-server.tsx
└── global.d.ts
```

### Key Changes:

1. **`src/lib/helpers/`** is eliminated by distributing to appropriate layers:
   - `image-processor.ts` → `domain/media/processing/`
   - `storage-drivers.ts` → `infrastructure/storage/`
   - `data-transformer.ts` → `domain/shared/validation.ts` and application services
   - `job-queue.ts` → `infrastructure/jobs/`
   - `utils.ts` → `domain/media/utils/`

2. **`src/lib/api/`** is split:
   - API client code → `infrastructure/api-clients/`
   - Business logic (like in `media.ts`) → `application/services/` or `domain/media/`

3. **`src/lib/drivers/`** → `infrastructure/storage/`

4. **`src/lib/types.ts` and `src/lib/schemas.ts`** are split by domain:
   - Media types/schemas → `domain/media/`
   - Source types/schemas → `domain/sources/`
   - etc.

5. **`src/lib/utils.ts`** → `presentation/utils/cn.ts` (UI-specific utility)

6. **`src/utils/`** is removed (currently empty)

7. **`src/services/`** → `application/services/` (for clarity and consistency)

### Migration Strategy:

- Use serena tools (`mcp__serena__*`) for all file operations
- Create new directory structure first
- Move files one module at a time, updating imports as you go
- Run tests after each major module migration to ensure nothing breaks
- Use `find_symbol` and `find_referencing_symbols` to track all usages before moving files
- Update import paths using `replace_regex` for efficiency

## Notes

- This specification focuses on structural reorganization, not implementation of TODO/unimplemented functions
- The proposed structure follows Clean Architecture / Hexagonal Architecture principles adapted for TypeScript
- Dependency direction: presentation → application → domain ← infrastructure (infrastructure also depends on domain interfaces)
- The `src/db/` directory is already well-placed as infrastructure, but could be moved to `infrastructure/db/` for consistency
- Some judgment calls will be needed during implementation for files with mixed concerns

# Feature Specification: Clean Up and Consolidate Duplicate Routes

**Feature Branch**: `004-src-routes-requirements`
**Created**: 2025-10-11
**Status**: Draft
**Input**: User description: "現在 @src/routes/ にルーティング上役割が被っているファイルがいくつか残っている、不要なものを削除、統合して
ルーティングの詳細は @requirements/external-doc/solid-router.md を参照
serenaを使うこと"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Duplicate Media Thumbnail Routes (Priority: P1)

As a developer maintaining the codebase, I need to eliminate duplicate thumbnail routes so that there is only one canonical path for accessing media thumbnails, preventing confusion and potential bugs from inconsistent implementations.

**Why this priority**: This is the highest priority because having two different routes serving the same functionality (`/api/sources/[sourceId]/[mediaId]/thumbnail` and `/api/sources/[sourceId]/media/[mediaId]/thumbnail`) creates maintenance burden and can lead to inconsistent behavior.

**Independent Test**: Can be fully tested by accessing media thumbnails via the consolidated route and verifying the duplicate route no longer exists, ensuring no functionality is lost.

**Acceptance Scenarios**:

1. **Given** a media item exists with ID `abc123` in source `src456`, **When** I request `/api/sources/src456/media/abc123/thumbnail`, **Then** the thumbnail is served successfully
2. **Given** the duplicate route at `/api/sources/[sourceId]/[mediaId]/thumbnail.ts` has been removed, **When** I attempt to access this old path, **Then** the system returns a 404 error
3. **Given** all media thumbnail functionality, **When** I use the consolidated route, **Then** all features (on-demand generation, caching, streaming) work identically to before

---

### User Story 2 - Consolidate Directory Listing Routes (Priority: P2)

As a developer working with directory listings, I need to consolidate the two overlapping directory listing implementations so that there is one clear, well-organized structure for directory operations.

**Why this priority**: This is second priority because the duplicate directory routes (`/api/sources/[sourceId]/directories/[...directories].ts` file vs `/api/sources/[sourceId]/directories/[...directories]/` directory) create ambiguity in the file structure and violate SolidStart routing conventions.

**Independent Test**: Can be fully tested by accessing directory listings through the consolidated nested route structure and verifying the standalone file route is removed.

**Acceptance Scenarios**:

1. **Given** a directory path exists at `photos/2024`, **When** I request `/api/sources/src456/directories/photos/2024`, **Then** the directory listing is returned correctly
2. **Given** the standalone `[...directories].ts` file has been removed, **When** the nested directory structure handles the catch-all route, **Then** all directory listing functionality continues to work
3. **Given** directory search functionality exists, **When** I access `/api/sources/src456/directories/photos/2024/search`, **Then** search results are returned correctly

---

### User Story 3 - Establish Canonical Media Route Structure (Priority: P3)

As a developer understanding the API structure, I need clear documentation of which routes should be used for media operations so that future development follows consistent patterns.

**Why this priority**: This is third priority because while documentation and clarity are important, the actual functionality will work once the duplicates are removed in P1 and P2.

**Independent Test**: Can be tested by reviewing the consolidated route structure and verifying it follows SolidStart file-based routing conventions.

**Acceptance Scenarios**:

1. **Given** the routes have been consolidated, **When** I examine the `src/routes/api/sources/[sourceId]/` directory, **Then** I see a clear structure with media operations under a dedicated path
2. **Given** the consolidated structure, **When** new developers review the routing, **Then** they can easily understand which paths handle which operations without encountering duplicates
3. **Given** the SolidStart routing documentation, **When** I compare our structure, **Then** it follows file-based routing best practices

---

### Edge Cases

- What happens when external code references the old duplicate routes that will be removed?
- How does the system handle if the duplicate routes have slightly different implementations or error handling?
- What if one route handles edge cases that the other doesn't?
- How do we ensure thumbnail generation works identically after consolidation?
- What happens to any cached routes or CDN configurations pointing to old paths?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove the duplicate thumbnail route at `/api/sources/[sourceId]/media/[mediaId]/thumbnail.ts`
- **FR-002**: System MUST consolidate all media-related operations under `/api/sources/[sourceId]/[mediaId]/` path structure
- **FR-003**: System MUST remove the standalone catch-all file `/api/sources/[sourceId]/directories/[...directories].ts`
- **FR-004**: System MUST use the nested directory structure `/api/sources/[sourceId]/directories/[...directories]/` for directory listing operations
- **FR-005**: System MUST maintain all existing functionality after route consolidation (no breaking changes to behavior)
- **FR-006**: System MUST ensure thumbnail generation, caching, and streaming work identically after consolidation
- **FR-007**: System MUST ensure directory listing and search operations work identically after consolidation
- **FR-008**: System MUST follow SolidStart file-based routing conventions where nested layouts use matching directory structures

### Key Entities *(include if feature involves data)*

- **Media Route**: Represents the API endpoint structure for accessing media items and their associated operations (thumbnails, tags, metadata, etc.)
- **Directory Route**: Represents the API endpoint structure for directory operations (listing, search, create, delete, rename)
- **Catch-all Route**: Dynamic route segments that match multiple path levels (e.g., `[...directories]`)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All duplicate routes identified (2 specific duplicates) are successfully removed from the codebase
- **SC-002**: All existing API functionality continues to work without breaking changes (100% functional parity)
- **SC-003**: Route structure follows SolidStart file-based routing conventions with no overlapping route definitions
- **SC-004**: No 404 errors occur for legitimate API requests after consolidation (existing functionality preserved)
- **SC-005**: Code review confirms a single canonical path exists for each API operation (no ambiguity)

## Identified Routing Conflicts

### Conflict 1: Duplicate Thumbnail Routes

**Location 1**: `src/routes/api/sources/[sourceId]/[mediaId]/thumbnail.ts`
- Matches pattern: `/api/sources/:sourceId/:mediaId/thumbnail`
- Implementation: Uses `getMediaThumbnail()` API

**Location 2**: `src/routes/api/sources/[sourceId]/media/[mediaId]/thumbnail.ts`
- Matches pattern: `/api/sources/:sourceId/media/:mediaId/thumbnail`
- Implementation: Uses `getMedia()` + `generateThumbnail()` with on-demand generation

**Recommendation**: Keep `src/routes/api/sources/[sourceId]/[mediaId]/thumbnail.ts` as it's simpler and part of the main media route structure. Remove the duplicate under `/media/[mediaId]/`.

### Conflict 2: Duplicate Directory Listing Routes

**Location 1**: `src/routes/api/sources/[sourceId]/directories/[...directories].ts` (standalone file)
- Matches pattern: `/api/sources/:sourceId/directories/**/*`
- Implementation: Uses `listMedia()` API

**Location 2**: `src/routes/api/sources/[sourceId]/directories/[...directories]/index.ts` (nested directory)
- Matches pattern: `/api/sources/:sourceId/directories/**/*`
- Implementation: Uses `getDirectoryListing()` API

**Additional Context**: The nested directory also contains `search.ts` which would be inaccessible if the standalone file takes precedence.

**Recommendation**: Remove the standalone `[...directories].ts` file and keep the nested directory structure with `index.ts` and `search.ts`, as this follows proper SolidStart nested routing conventions.

## Implementation Notes

Following SolidStart routing conventions (from `requirements/external-doc/solid-router.md`):

1. **Nested Routes**: When a file and directory share the same name pattern, the file acts as a layout. In this case, we have conflicting catch-all patterns.
2. **Dynamic Routes**: Square brackets define dynamic segments. `[...directories]` is a catch-all that matches any number of segments.
3. **File Precedence**: A standalone file like `[...directories].ts` would take precedence over a directory structure `[...directories]/index.ts`.

The consolidation should:
- Use nested directory structures for related operations
- Keep all media operations under `/api/sources/[sourceId]/[mediaId]/`
- Use the nested `[...directories]/` structure for directory operations
- Remove standalone files that create routing ambiguity

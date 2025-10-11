# Implementation Plan: Clean Up and Consolidate Duplicate Routes

**Branch**: `004-src-routes-requirements` | **Date**: 2025-10-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-src-routes-requirements/spec.md`

## Summary

Remove duplicate and overlapping route definitions in `src/routes/api/sources/[sourceId]/` to establish a single canonical routing structure following SolidStart conventions. The feature addresses two main conflicts:

1. **Thumbnail Routes**: Keep the fully-implemented `/media/[mediaId]/thumbnail.ts` route and remove the stub implementation at `/[mediaId]/thumbnail.ts`
2. **Directory Listing Routes**: Keep the nested directory structure `/directories/[...directories]/` and remove the conflicting standalone file `/directories/[...directories].ts`

**Critical Discovery**: During research, found that `getMediaThumbnail()` used by `/[mediaId]/thumbnail.ts` is not implemented (throws "Not implemented"), while `/media/[mediaId]/thumbnail.ts` has a complete working implementation with on-demand generation, caching, and proper error handling.

## Technical Context

**Language/Version**: TypeScript / Node.js 22+
**Primary Dependencies**: @solidjs/start 1.2.0, @solidjs/router 0.15.3, solid-js 1.9.9, vinxi 0.5.8
**Storage**: PostgreSQL via Drizzle ORM 0.44.5, File system (.cache/thumbnails for thumbnail storage)
**Testing**: Vitest 3.2.4 (unit), Playwright 1.55.1 (e2e), @vitest/coverage-v8 3.2.4
**Target Platform**: Web server (Linux/Node.js)
**Project Type**: Web application (SolidStart full-stack)
**Performance Goals**: Fast file-based routing resolution, efficient thumbnail serving
**Constraints**: Must maintain 100% functional parity, no breaking changes to existing API contracts
**Scale/Scope**: Small refactoring (2 file deletions, no new code), affects 2 route endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: N/A - Constitution template not yet filled

This is a refactoring task with no new functionality, so constitutional principles about test-first development and new features don't apply. The task focuses on:
- Code organization and maintainability
- Following framework conventions (SolidStart routing)
- Eliminating ambiguity in route resolution

## Project Structure

### Documentation (this feature)

```
specs/004-src-routes-requirements/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file
└── [no additional artifacts needed for this refactoring]
```

**Note**: This refactoring task doesn't require data-model.md, contracts/, or quickstart.md since we're not adding new functionality or changing contracts - only removing duplicate route files.

### Source Code (repository root)

Current structure (showing relevant areas):

```
src/
├── routes/
│   ├── api/
│   │   └── sources/
│   │       └── [sourceId]/
│   │           ├── [mediaId]/
│   │           │   ├── index.ts
│   │           │   ├── thumbnail.ts          ← TO BE REMOVED (stub)
│   │           │   ├── tags.ts
│   │           │   ├── details.ts
│   │           │   ├── metadata.ts
│   │           │   ├── charactors.ts
│   │           │   ├── ips.ts
│   │           │   └── upload.ts
│   │           ├── media/
│   │           │   └── [mediaId]/
│   │           │       └── thumbnail.ts      ← KEEPING (full implementation)
│   │           └── directories/
│   │               ├── [...directories].ts   ← TO BE REMOVED (conflicts with directory below)
│   │               └── [...directories]/
│   │                   ├── index.ts          ← KEEPING (proper implementation)
│   │                   └── search.ts
│   ├── components/
│   ├── lib/
│   │   ├── api/
│   │   │   ├── media.ts                      # Contains getMediaThumbnail stub
│   │   │   └── directories.ts
│   │   └── thumbnails.ts
│   └── tests/
│       ├── e2e/
│       │   ├── thumbnails.spec.ts            # Uses /media/[mediaId]/thumbnail
│       │   └── media-api.spec.ts             # Uses /directories/[...directories]
│       ├── integration/
│       └── unit/
```

Target structure after cleanup:

```
src/
├── routes/
│   ├── api/
│   │   └── sources/
│   │       └── [sourceId]/
│   │           ├── [mediaId]/
│   │           │   ├── index.ts
│   │           │   ├── tags.ts
│   │           │   ├── details.ts
│   │           │   ├── metadata.ts
│   │           │   ├── charactors.ts
│   │           │   ├── ips.ts
│   │           │   └── upload.ts
│   │           ├── media/
│   │           │   └── [mediaId]/
│   │           │       └── thumbnail.ts      ✓ Full implementation remains
│   │           └── directories/
│   │               └── [...directories]/
│   │                   ├── index.ts          ✓ Nested structure remains
│   │                   └── search.ts
```

**Structure Decision**: Using SolidStart's web application structure with file-based routing. The chosen structure follows these principles:

1. **Nested routes for related operations**: `/media/[mediaId]/` groups media-specific operations
2. **Catch-all routes in directories**: `/directories/[...directories]/` properly uses nested directory structure
3. **Clear separation of concerns**: Media operations separate from directory operations

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

N/A - This is a simplification task that reduces complexity by removing duplicates.

## Implementation Approach

### Phase 0: Pre-Implementation Verification

**Objective**: Verify the complete implementation details and test coverage before making changes

**Tasks**:
1. ✅ Confirm `getMediaThumbnail()` in `src/lib/api/media.ts` is not implemented
2. ✅ Verify `/media/[mediaId]/thumbnail.ts` has complete working implementation
3. ✅ Confirm tests use the routes we're keeping (thumbnails.spec.ts, media-api.spec.ts)
4. ✅ Verify no client code directly references the routes being removed
5. Document the functional differences between implementations

**Deliverable**: Research findings (documented inline in this plan)

**Research Findings**:

**Thumbnail Route Analysis**:
- `/[mediaId]/thumbnail.ts`: Uses `getMediaThumbnail()` which throws "Not implemented"
- `/media/[mediaId]/thumbnail.ts`: Complete implementation with:
  - On-demand thumbnail generation using `sharp`
  - File system caching in `.cache/thumbnails/`
  - Proper error handling (404 for missing media, 400 for invalid sources)
  - WebP format streaming
  - Source validation (local sources only)

**Decision**: Keep `/media/[mediaId]/thumbnail.ts` (contradicts initial spec recommendation)

**Directory Route Analysis**:
- `/directories/[...directories].ts`: Uses `listMedia()` API
- `/directories/[...directories]/index.ts`: Uses `getDirectoryListing()` API
- Both appear functional, but standalone file would block access to `search.ts` in nested directory

**Decision**: Keep nested directory structure as originally recommended

### Phase 1: Route Consolidation

**Objective**: Remove duplicate route files and verify routing still works

**Tasks**:
1. Remove `src/routes/api/sources/[sourceId]/[mediaId]/thumbnail.ts`
2. Remove `src/routes/api/sources/[sourceId]/directories/[...directories].ts`
3. Run type checking (`npm run check`)
4. Run linting (`npm run lint`)
5. Verify no import errors or broken references

**Acceptance Criteria**:
- Both files successfully deleted
- No TypeScript errors
- No linting errors
- Build succeeds (`npm run build`)

### Phase 2: Test Verification

**Objective**: Ensure all existing tests pass without modification

**Tasks**:
1. Run e2e tests: `npm run test:e2e`
   - Verify `src/tests/e2e/thumbnails.spec.ts` passes
   - Verify `src/tests/e2e/media-api.spec.ts` passes
2. Run unit tests: `npm test`
3. Run integration tests if they exist
4. Verify all tests pass without any modifications to test code

**Acceptance Criteria**:
- All e2e tests pass (thumbnails, media-api)
- All unit tests pass
- No test modifications required
- 100% functional parity confirmed

### Phase 3: Documentation and Cleanup

**Objective**: Update any documentation and verify completeness

**Tasks**:
1. Check if any inline documentation references the removed routes
2. Update route documentation if it exists (README, API docs)
3. Verify the route structure follows SolidStart conventions
4. Consider if `getMediaThumbnail()` stub should be removed or implemented

**Acceptance Criteria**:
- No stale documentation references
- Route structure is clear and unambiguous
- Decision made on `getMediaThumbnail()` stub (remove or implement later)

## Dependencies and Risks

### Dependencies
- No external dependencies
- No database migrations required
- No configuration changes needed

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing code references removed routes | Low | High | Search codebase for route path strings before deletion |
| Tests break after removal | Low | Medium | Tests already use the routes we're keeping |
| Cached routing causes issues | Low | Low | Clear `.vinxi` build cache if needed |
| `getMediaThumbnail()` stub causes confusion | Medium | Low | Add TODO comment or implement it to call the working route |

### Rollback Plan

If issues are discovered:
1. Git revert the changes (simple file deletions)
2. Routes can be restored from git history
3. No data migration or state changes to reverse

## Testing Strategy

### Pre-Change Testing
- [x] Identify which routes are used by existing tests
- [x] Confirm tests use routes being kept, not routes being removed

### Post-Change Testing
- [ ] Run full test suite (unit, integration, e2e)
- [ ] Manual verification of thumbnail serving
- [ ] Manual verification of directory listing
- [ ] Verify 404 responses for removed routes

### Test Coverage
- Existing tests cover the functionality
- No new test files needed
- No test modifications needed

## Success Criteria

From spec.md:
- **SC-001**: All duplicate routes identified (2 specific duplicates) are successfully removed from the codebase ✓
- **SC-002**: All existing API functionality continues to work without breaking changes (100% functional parity) - Verified via tests
- **SC-003**: Route structure follows SolidStart file-based routing conventions with no overlapping route definitions ✓
- **SC-004**: No 404 errors occur for legitimate API requests after consolidation (existing functionality preserved) - Verified via e2e tests
- **SC-005**: Code review confirms a single canonical path exists for each API operation (no ambiguity) ✓

## Next Steps

After this plan is approved:
1. Run `/tasks` command to generate detailed task breakdown (optional, may be overkill for this simple refactoring)
2. Execute the implementation (Phase 1-3)
3. Create PR with clear before/after routing structure

**Estimated Effort**: 1-2 hours (including testing)
**Complexity**: Low (file deletions only, no code changes)
**Risk Level**: Low (easily reversible, good test coverage)

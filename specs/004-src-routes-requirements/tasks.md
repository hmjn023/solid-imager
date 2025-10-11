# Tasks: Clean Up and Consolidate Duplicate Routes

**Input**: Design documents from `/specs/004-src-routes-requirements/`
**Prerequisites**: plan.md ✓, spec.md ✓

**Note**: This is a refactoring task with no new functionality. Tasks focus on file deletion and verification. No new tests are required as existing tests already cover the functionality we're keeping.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Critical Discovery from Planning

⚠️ **Route Decision Changed**: During planning, discovered that:
- `/[mediaId]/thumbnail.ts` uses `getMediaThumbnail()` which is **not implemented** (stub)
- `/media/[mediaId]/thumbnail.ts` has the **complete working implementation**
- **Decision**: Keep `/media/[mediaId]/thumbnail.ts` (opposite of initial spec recommendation)

---

## Phase 1: Pre-Flight Verification

**Purpose**: Final verification before making changes (already done in planning, but re-verify for safety)

- [x] T001 [P] [ALL] Search codebase for hardcoded references to `/api/sources/[sourceId]/[mediaId]/thumbnail` route path string
- [x] T002 [P] [ALL] Search codebase for hardcoded references to `/api/sources/[sourceId]/directories/[...directories]` route path string (file, not directory)
- [x] T003 [ALL] Verify existing e2e tests use routes we're keeping: check `src/tests/e2e/thumbnails.spec.ts` and `src/tests/e2e/media-api.spec.ts`

**Checkpoint**: If any hardcoded references found in T001-T002, must update them first before deletion

---

## Phase 2: User Story 1 - Remove Duplicate Media Thumbnail Routes (Priority: P1) 🎯

**Goal**: Remove the stub thumbnail route, keeping the fully-implemented route

**Independent Test**: After removal, `/api/sources/:sourceId/media/:mediaId/thumbnail` serves thumbnails correctly

### Implementation for User Story 1

- [x] T004 [US1] **Delete file**: `src/routes/api/sources/[sourceId]/[mediaId]/thumbnail.ts` (the stub route)
- [x] T005 [US1] Run type checking: `bun run check` or `npm run check`
- [x] T006 [US1] Run linting: `bun run lint` or `npm run lint`
- [x] T007 [US1] Verify thumbnail route still accessible: Check that `/api/sources/:sourceId/media/:mediaId/thumbnail` pattern exists in file tree
- [ ] T008 [US1] Run e2e thumbnail tests: `bun run test:e2e src/tests/e2e/thumbnails.spec.ts` to verify functionality preserved

**Checkpoint**: US1 complete - thumbnail routes consolidated, tests pass

---

## Phase 3: User Story 2 - Consolidate Directory Listing Routes (Priority: P2)

**Goal**: Remove standalone directory listing file, keeping nested directory structure

**Independent Test**: After removal, `/api/sources/:sourceId/directories/**/*` returns directory listings and search works

### Implementation for User Story 2

- [x] T009 [US2] **Delete file**: `src/routes/api/sources/[sourceId]/directories/[...directories].ts` (the standalone file)
- [x] T010 [US2] Verify nested directory structure remains: Confirm `src/routes/api/sources/[sourceId]/directories/[...directories]/index.ts` and `search.ts` still exist
- [x] T011 [US2] Run type checking: `bun run check` or `npm run check`
- [x] T012 [US2] Run linting: `bun run lint` or `npm run lint`
- [ ] T013 [US2] Run e2e directory tests: `bun run test:e2e src/tests/e2e/media-api.spec.ts` to verify directory listing works
- [ ] T014 [US2] Manual verification: Test that directory search endpoint `/api/sources/:sourceId/directories/[path]/search` is accessible

**Checkpoint**: US2 complete - directory routes consolidated, tests pass

---

## Phase 4: User Story 3 - Establish Canonical Media Route Structure (Priority: P3)

**Goal**: Document and verify the final route structure follows SolidStart conventions

**Independent Test**: Route structure is clear, unambiguous, and follows framework conventions

### Implementation for User Story 3

- [x] T015 [P] [US3] Document final route structure: Update `IMPLEMENTATION_STATUS.md` or relevant docs with before/after routing structure
- [x] T016 [P] [US3] Verify SolidStart conventions: Confirm nested directories for grouped operations, no file/folder conflicts
- [x] T017 [US3] **Optional cleanup**: Consider adding TODO comment to `getMediaThumbnail()` stub in `src/lib/api/media.ts` noting it's not used
- [ ] T018 [US3] **Optional implementation**: Implement `getMediaThumbnail()` to proxy to the working route for API consistency (low priority)

**Checkpoint**: US3 complete - route structure documented and verified

---

## Phase 5: Final Verification & Integration

**Purpose**: Full system verification and cleanup

- [ ] T019 [P] Run full test suite: `bun run test` or `npm test` (all unit tests)
- [ ] T020 [P] Run all e2e tests: `bun run test:e2e` (verify no regressions)
- [ ] T021 Build verification: `bun run build` or `npm run build` - ensure build succeeds
- [ ] T022 Clear build cache if needed: Remove `.vinxi` directory if routing behaves unexpectedly
- [ ] T023 Verify 404 for removed routes: Manually test that old routes return 404 (if dev server running)
- [ ] T024 Git commit: Stage changes and commit with message documenting route consolidation

**Checkpoint**: All tests pass, build succeeds, documentation updated

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Phase 1 (Pre-Flight)**: Run first - BLOCKS everything if issues found
2. **Phase 2 (US1 - Thumbnails)**: Can start after Phase 1 completes
3. **Phase 3 (US2 - Directories)**: Can start after Phase 1 completes (independent of US1)
4. **Phase 4 (US3 - Documentation)**: Should wait until US1 and US2 complete
5. **Phase 5 (Final Verification)**: Must run after all user stories complete

### User Story Independence

- **US1 (Thumbnails)** and **US2 (Directories)** are **independent** - can be done in parallel
- **US3 (Documentation)** should wait for US1 and US2 to document the final state

### Within Each User Story

Tasks within each story are **sequential** (not parallel) because they operate on related files and depend on previous verification steps.

### Parallel Opportunities

```bash
# Phase 1: Pre-flight checks can run in parallel
Task T001 and T002 can run together (different search patterns)

# US1 and US2: Can work on different route groups in parallel
Developer A: Complete T004-T008 (thumbnail route)
Developer B: Complete T009-T014 (directory route)

# Phase 4: Documentation tasks can run in parallel
Task T015 and T016 can run together (different aspects)

# Phase 5: Test and build can run in parallel initially
Task T019 and T020 can start together, T021 waits for both
```

---

## Implementation Strategy

### Sequential Approach (Recommended for Safety)

1. **Phase 1**: Pre-flight verification → Ensure no hardcoded references
2. **US1 First** (T004-T008): Remove thumbnail duplicate → Test → Commit
3. **US2 Second** (T009-T014): Remove directory duplicate → Test → Commit
4. **US3 Third** (T015-T018): Document structure → Commit
5. **Phase 5**: Full verification → Final commit

**Advantage**: Safer, easier to rollback individual changes, clear checkpoints

### Parallel Approach (Faster if Multiple Developers)

1. **Phase 1**: Pre-flight verification (team effort)
2. **Split work after Phase 1**:
   - Developer A: US1 (thumbnails) → T004-T008
   - Developer B: US2 (directories) → T009-T014
3. **Merge**: Both developers coordinate
4. **Together**: US3 (documentation) → T015-T018
5. **Together**: Phase 5 (final verification)

**Advantage**: Faster completion, good for team learning

---

## Rollback Plan

If issues discovered:
- **After T004**: `git restore src/routes/api/sources/[sourceId]/[mediaId]/thumbnail.ts`
- **After T009**: `git restore src/routes/api/sources/[sourceId]/directories/[...directories].ts`
- **After T024**: `git revert HEAD` or `git reset --hard HEAD~1`

---

## Success Criteria Verification

Map tasks to spec.md success criteria:

- **SC-001** (2 duplicates removed): Verified by T004 and T009 completion
- **SC-002** (100% functional parity): Verified by T008, T013, T019, T020
- **SC-003** (SolidStart conventions): Verified by T016
- **SC-004** (No 404 for valid requests): Verified by T008, T013, T023
- **SC-005** (Single canonical path): Verified by T007, T010, T015, T016

---

## Notes

- **No new code written** - only file deletions
- **No test modifications needed** - existing tests already use correct routes
- **Estimated time**: 30-60 minutes for sequential, 20-30 minutes for parallel
- **Risk level**: Very low - simple file deletions, easily reversible
- **Test coverage**: Existing e2e tests provide verification
- Each task should be committed individually or in logical groups for easy rollback
- Use `bun` or `npm` based on project preference (bun is faster)

## Files Affected

**Deleted** (2 files):
- `src/routes/api/sources/[sourceId]/[mediaId]/thumbnail.ts`
- `src/routes/api/sources/[sourceId]/directories/[...directories].ts`

**Kept** (2 route implementations):
- `src/routes/api/sources/[sourceId]/media/[mediaId]/thumbnail.ts` ✓
- `src/routes/api/sources/[sourceId]/directories/[...directories]/index.ts` ✓
- `src/routes/api/sources/[sourceId]/directories/[...directories]/search.ts` ✓

**Optionally Modified** (documentation only):
- `IMPLEMENTATION_STATUS.md` or similar docs (T015)
- `src/lib/api/media.ts` - add TODO to `getMediaThumbnail()` stub (T017)

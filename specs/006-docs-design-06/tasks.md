# Tasks: Media Delivery and Media List

**Input**: Design documents from `/specs/006-docs-design-06/`

## Phase 1: Foundational (Services Implementation)

- [ ] **T001**: Implement `DirectoryService.listMediaInSubdirectory` in `src/application/services/directory-service.ts`.
- [ ] **T002**: Implement `ThumbnailService.getMediaThumbnail` in `src/application/services/thumbnail-service.ts`.

## Phase 2: API Routes

- [ ] **T003**: Create the API route for media list at `src/routes/api/sources/[sourceId]/directories/[...directories].ts`.
- [ ] **T004**: Create the API route for thumbnails at `src/routes/api/sources/[sourceId]/[mediaId]/thumbnail.ts`.

## Phase 3: Testing

- [ ] **T005** [P]: Write unit tests for `DirectoryService.listMediaInSubdirectory` in `src/tests/unit/services/directory-service.spec.ts`.
- [ ] **T006** [P]: Write unit tests for `ThumbnailService.getMediaThumbnail` in `src/tests/unit/services/thumbnail-service.spec.ts`.
- [ ] **T007** [P]: Write an integration test for the media list API endpoint in `src/tests/integration/api/media-list.spec.ts`.
- [ ] **T008** [P]: Write an integration test for the thumbnail API endpoint in `src/tests/integration/api/thumbnail.spec.ts`.

## Dependencies & Execution Order

1.  **Phase 1 (Services)** can be done in parallel.
2.  **Phase 2 (API Routes)** depends on Phase 1.
3.  **Phase 3 (Testing)** can be done in parallel after the corresponding implementation is complete.

### Parallel Execution Example

```bash
# Launch service implementation in parallel
Task: "Implement DirectoryService.listMediaInSubdirectory in src/application/services/directory-service.ts"
Task: "Implement ThumbnailService.getMediaThumbnail in src/application/services/thumbnail-service.ts"

# Launch unit tests in parallel after services are implemented
Task: "Write unit tests for DirectoryService.listMediaInSubdirectory in src/tests/unit/services/directory-service.spec.ts"
Task: "Write unit tests for ThumbnailService.getMediaThumbnail in src/tests/unit/services/thumbnail-service.spec.ts"
```
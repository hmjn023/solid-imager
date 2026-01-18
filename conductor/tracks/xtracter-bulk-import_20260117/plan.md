# Implementation Plan - Xtracter Bulk Import & Preview

## Phase 1: Backend Schema & API Implementation
- [x] Task: Define shared schemas (Zod) for Import/Export ensuring compatibility with `BackupService`. [dff7c3d]
    - [ ] Sub-task: Create `import-schemas.ts` in `domain/media` (or share with backup).
    - [ ] Sub-task: Update `api-contract.ts` to include `downloads.preview`.
- [x] Task: Implement `downloads.preview` ORPC procedure. [b0c6769]
    - [ ] Sub-task: Write tests for `downloads-router.ts` (preview endpoint).
    - [ ] Sub-task: Implement handler to save data to `jobs` table with `pending_approval` status.
- [x] Task: Refactor `BackupService` to expose schema transformation logic. [b040527]
    - [ ] Sub-task: Extract schema validation/transformation logic for reusability.
- [ ] Task: Conductor - User Manual Verification 'Backend Schema & API Implementation' (Protocol in workflow.md)

## Phase 2: Xtracter Extension Update
- [ ] Task: Update `xtracter` data extraction logic.
    - [ ] Sub-task: Modify `types.ts` to match the new shared schema.
    - [ ] Sub-task: Implement tag and author extraction mapping.
- [ ] Task: Implement "Send to Imager" feature.
    - [ ] Sub-task: Add UI button in Popup.
    - [ ] Sub-task: Call `orpc.downloads.preview` with extracted data.
- [ ] Task: Conductor - User Manual Verification 'Xtracter Extension Update' (Protocol in workflow.md)

## Phase 3: Frontend Preview UI Implementation
- [ ] Task: Implement Preview Modal Component.
    - [ ] Sub-task: Create `ImportPreviewModal.tsx`.
    - [ ] Sub-task: Implement list view with selection checkboxes.
- [ ] Task: Integrate Preview Flow.
    - [ ] Sub-task: Fetch pending jobs from `jobs` table.
    - [ ] Sub-task: Connect "Import" button to `downloads.start` (or execute job).
- [ ] Task: Conductor - User Manual Verification 'Frontend Preview UI Implementation' (Protocol in workflow.md)

## Phase 4: Integration & Verification
- [ ] Task: End-to-End Testing.
    - [ ] Sub-task: Verify flow from Browser Extension -> Backend -> Preview Modal -> DB Save.
    - [ ] Sub-task: Verify tags and authors are correctly saved.
- [ ] Task: Conductor - User Manual Verification 'Integration & Verification' (Protocol in workflow.md)

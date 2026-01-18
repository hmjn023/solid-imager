# Implementation Plan - Xtracter Bulk Import & Preview

## Phase 1: Backend Schema & API Implementation [checkpoint: 281effb]
- [x] Task: Define shared schemas (Zod) for Import/Export ensuring compatibility with `BackupService`. [dff7c3d]
    - [ ] Sub-task: Create `import-schemas.ts` in `domain/media` (or share with backup).
    - [ ] Sub-task: Update `api-contract.ts` to include `downloads.preview`.
- [x] Task: Implement `downloads.preview` ORPC procedure. [b0c6769]
    - [ ] Sub-task: Write tests for `downloads-router.ts` (preview endpoint).
    - [ ] Sub-task: Implement handler to save data to `jobs` table with `pending_approval` status.
- [x] Task: Refactor `BackupService` to expose schema transformation logic. [b0a2dee]
    - [ ] Sub-task: Extract schema validation/transformation logic for reusability.
- [x] Task: Conductor - User Manual Verification 'Backend Schema & API Implementation' (Protocol in workflow.md) [281effb]

## Phase 2: Xtracter Extension Update [checkpoint: dd1ef25]
- [x] Task: Update `xtracter` data extraction logic. [fb0a55e]
    - [ ] Sub-task: Modify `types.ts` to match the new shared schema.
    - [ ] Sub-task: Implement tag and author extraction mapping.
- [x] Task: Implement "Send to Imager" feature. [fb0a55e]
    - [ ] Sub-task: Add UI button in Popup.
    - [ ] Sub-task: Call `orpc.downloads.preview` with extracted data.
- [x] Task: Conductor - User Manual Verification 'Xtracter Extension Update' (Protocol in workflow.md) [dd1ef25]

## Phase 3: Frontend Preview UI Implementation
- [x] Task: Implement Preview Modal Component. [dd1ef25]
    - [ ] Sub-task: Create `ImportPreviewModal.tsx`.
    - [ ] Sub-task: Implement list view with selection checkboxes.
- [x] Task: Integrate Preview Flow. [fb0a55e]
    - [ ] Sub-task: Fetch pending jobs from `jobs` table.
    - [ ] Sub-task: Connect "Import" button to `downloads.start` (or execute job).
- [~] Task: Conductor - User Manual Verification 'Frontend Preview UI Implementation' (Protocol in workflow.md)

## Phase 4: Integration & Verification
- [ ] Task: End-to-End Testing.
    - [ ] Sub-task: Verify flow from Browser Extension -> Backend -> Preview Modal -> DB Save.
    - [ ] Sub-task: Verify tags and authors are correctly saved.
- [ ] Task: Conductor - User Manual Verification 'Integration & Verification' (Protocol in workflow.md)

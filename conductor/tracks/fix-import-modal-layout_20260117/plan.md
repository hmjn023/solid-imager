# Implementation Plan - Fix Import Preview Modal Layout

## Phase 1: Modal Layout Refinement [checkpoint: e2d3998]
- [x] Task: Adjust Modal CSS and Structure. f882320
    - [x] Sub-task: Increase `z-index` of `ImportPreviewModal` to `z-[60]` or higher to exceed navigation bar (`z-50`).
    - [x] Sub-task: Modify container layout from `items-center` to a more robust positioning (e.g., `items-start` with `pt-20` or fixed layout) to prevent top overflow.
    - [x] Sub-task: Ensure `max-h-[90vh]` and `overflow-y-auto` are correctly applied to the content area.
- [x] Task: Conductor - User Manual Verification 'Modal Layout Refinement' (Protocol in workflow.md) f882320

## Phase 2: Verification
- [ ] Task: Visual Verification.
    - [ ] Sub-task: Test with many items (forcing scroll) and verify top header visibility.
- [ ] Task: Conductor - User Manual Verification 'Verification' (Protocol in workflow.md)

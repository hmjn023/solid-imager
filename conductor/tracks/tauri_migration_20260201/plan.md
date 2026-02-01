# Implementation Plan - Track: Tauri Infrastructure & Monorepo Migration (Phase 1-3)

## Phase 1: Core Package Extraction & Setup
- [x] Task: Create `packages/core` directory structure and initialize `package.json` for Bun Workspaces. <!-- 59437f3 -->
- [x] Task: Configure Bun Workspaces in the root `package.json`. <!-- 565025d -->
- [x] Task: Move `src/domain` entities and logic to `packages/core/src/domain`. <!-- ab4a704 -->
    - [x] Subtask: Identify pure TypeScript domain logic (no Node.js deps).
    - [x] Subtask: Move files and update internal relative imports within `core`.
- [x] Task: Move shared Zod schemas to `packages/core/src/schema`. <!-- ab4a704 -->
- [x] Task: Refactor `apps/server` (original src) to import from `@solid-imager/core` (or equivalent alias). <!-- ab4a704 -->
- [x] Task: Verify that `packages/core` builds/lints correctly without Node.js specific dependencies. <!-- 09607e9 -->

## Phase 2: Abstraction Layer Implementation
- [ ] Task: Define `IFileSystem` interface in `packages/core`.
    - [ ] Subtask: Create `packages/core/src/interfaces/file-system.ts`.
- [ ] Task: Define `IMediaStorage` interface in `packages/core`.
    - [ ] Subtask: Create `packages/core/src/interfaces/media-storage.ts`.
- [ ] Task: Define `IConfigService` interface in `packages/core`.
    - [ ] Subtask: Create `packages/core/src/interfaces/config-service.ts`.
- [ ] Task: Implement `NodeFileSystem` (Server implementation) in `apps/server`.
    - [ ] Subtask: Create class implementing `IFileSystem` using `node:fs`.
    - [ ] Subtask: Refactor existing file system usage to use this implementation.
    - [ ] Subtask: Update unit tests to mock `IFileSystem` instead of `node:fs`.
- [ ] Task: Implement `ServerMediaStorage` in `apps/server`.
    - [ ] Subtask: Rename/Refactor `LocalMediaStorage` to `ServerMediaStorage`.
    - [ ] Subtask: Ensure it implements `IMediaStorage`.
    - [ ] Subtask: Update unit tests.
- [ ] Task: Implement `EnvConfigService` in `apps/server`.
    - [ ] Subtask: Create wrapper around `process.env`.
    - [ ] Subtask: Refactor configuration usage.
- [ ] Task: Conductor - User Manual Verification 'Abstraction Layer Implementation' (Protocol in workflow.md)

## Phase 3: Monorepo Restructuring (The Big Move)
- [ ] Task: Prepare `apps/server` directory.
    - [ ] Subtask: Move remaining `src` content to `apps/server/src`.
    - [ ] Subtask: Move `package.json` (server specific) and configuration files.
- [ ] Task: Update `tsconfig.json` paths and aliases for the new structure.
- [ ] Task: Update `vite.config.ts` (or `app.config.ts`) to reflect new root and aliases.
- [ ] Task: Fix all import paths in `apps/server` to correctly reference `packages/core` and internal modules.
- [ ] Task: Update CI/CD configuration (if any) and local scripts in root `package.json` to trigger workspace scripts.
- [ ] Task: Conductor - User Manual Verification 'Monorepo Restructuring' (Protocol in workflow.md)

## Phase 4: Documentation Update
- [ ] Task: Update `AGENTS.md` to reflect the new monorepo structure, updated paths, and new coding rules.
- [ ] Task: Update `docs/architecture/ARCHITECTURE.md` to document the core/server separation and abstraction layers.
- [ ] Task: Update all relative links within the `docs/` directory to ensure they point to the correct locations in the monorepo.
- [ ] Task: Update the "Development Setup" instructions in various READMEs to reflect Bun Workspaces usage.
- [ ] Task: Conductor - User Manual Verification 'Documentation Update' (Protocol in workflow.md)
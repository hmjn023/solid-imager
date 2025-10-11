# Tasks: Skeleton Test Implementation

**Feature**: 003-skeleton-tests
**Branch**: `003-skeleton-tests`
**Input**: Design documents from `/home/hmjn/project/web/solid-imager/specs/003-/`

**Prerequisites**:
- Serena MCP Server active and connected
- solid-imager project activated in Serena
- Git clean state
- Bun runtime installed

**Organization**: Tasks are organized by implementation phase, following the plan.md structure.

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

---

## Phase 0: Preparation & Setup

**Purpose**: Verify prerequisites and establish baseline

- [X] T001 Verify Serena MCP is active and solid-imager project is activated
- [X] T002 Verify git status is clean (commit or stash changes if needed)
- [X] T003 Run baseline tests and capture output to `specs/003-/baseline-tests.txt`
- [X] T004 Count API routes: `find src/routes/api -type f -name "*.ts" ! -name "*.test.ts" | wc -l` (expect 32)
- [X] T005 Count existing test files: `find src/tests -name "*.test.ts" -o -name "*.spec.ts" | wc -l` (expect 31): `find src/tests -name "*.test.ts" -o -name "*.spec.ts" | wc -l` (expect 31)

**Checkpoint**: Prerequisites verified, baseline captured

---

## Phase 1: API Route Discovery

**Purpose**: Discover all API routes and parse their metadata

### Discovery Tasks

- [X] T006 Use Serena `list_dir` to discover all API route files in `src/routes/api` (recursive)
- [X] T007 Filter discovered files to exclude test files (*.test.ts, *.spec.ts)
- [X] T008 Create `APIRoute[]` collection to store route metadata
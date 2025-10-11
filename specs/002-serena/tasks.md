# Tasks: Function Argument Correction Using Serena

**Input**: Design documents from `/specs/002-serena/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: This is a code quality improvement (refactoring) task, not a traditional feature with user stories. Tasks are organized by implementation phase from the plan.

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/` at repository root
- This is a SolidStart web application

---

## Phase 1: Setup & Preparation

**Purpose**: Initialize environment and establish baseline

- [X] T001 Verify Serena MCP server is active and solid-imager project is activated
- [X] T002 Create git backup branch: `git checkout -b 002-serena-backup && git checkout 002-serena`
- [X] T003 Establish baseline by running: `npx tsc --noEmit > baseline-errors.txt` and `bun run check > baseline-lint.txt`
- [X] T004 Verify `src/db/db.ts` is unused: `grep -r "from.*db/db" src/` (NOTE: Found 5 test imports, fixed them first)
- [X] T005 Delete duplicate database module: `rm src/db/db.ts`
- [X] T006 Verify build still works after deletion: `bun run check`

**Checkpoint**: Clean baseline established, duplicate file removed

---

## Phase 2: Function Discovery

**Purpose**: Build complete catalog of all functions in the project

**Note**: These tasks scan different directories and can run in parallel

- [ ] T007 [P] Discover functions in src/lib using Serena `find_symbol` with `relative_path: "src/lib"`, `include_kinds: [12]`, `include_body: true`
- [ ] T008 [P] Discover functions in src/services using Serena `find_symbol` with `relative_path: "src/services"`, `include_kinds: [12]`, `include_body: true`
- [ ] T009 [P] Discover functions in src/routes/api using Serena `find_symbol` with `relative_path: "src/routes/api"`, `include_kinds: [12]`, `include_body: true`
- [ ] T010 [P] Discover functions in src/db/index.ts using Serena `find_symbol` with `relative_path: "src/db/index.ts"`, `include_kinds: [12]`, `include_body: true`
- [ ] T011 Parse function bodies to extract parameter signatures (names, types, optional markers, defaults)
- [ ] T012 Build `FunctionSignature[]` collection and export to `specs/002-serena/function-catalog.json`

**Deliverable**: Function catalog with ~150 functions

**Checkpoint**: All functions discovered and cataloged

---

## Phase 3: Call Site Discovery & Analysis

**Purpose**: Find all invocations of each function and validate arguments

**Note**: These tasks are sequential as they build on the function catalog

- [ ] T013 For each function in catalog, use Serena `find_referencing_symbols` to find all call sites
- [ ] T014 Parse code snippets from references to extract call arguments
- [ ] T015 Build `CallSite[]` collection with argument information
- [ ] T016 Export call site catalog to `specs/002-serena/callsite-catalog.json`

**Deliverable**: Call site catalog with ~500-1000 call sites

- [ ] T017 Compare each `CallSite` against its `FunctionSignature` to validate:
  - Argument count matches parameter count (accounting for optional/rest)
  - Argument order matches parameter order
  - Argument types are compatible with parameter types (best-effort)
- [ ] T018 Generate `ArgumentMismatch[]` for all discrepancies found
- [ ] T019 Classify each mismatch by severity (error/warning/info) and type (wrong_count, wrong_order, wrong_type, etc.)
- [ ] T020 Calculate fix confidence score (0-100) for each mismatch
- [ ] T021 Export mismatch report to `specs/002-serena/mismatch-report.json` grouped by file, function, and severity

**Deliverable**: Mismatch report with ~10-50 mismatches (estimated)

**Checkpoint**: All mismatches identified and classified

---

## Phase 4: Fix Strategy Generation

**Purpose**: Generate fix patterns for each fixable mismatch

**Note**: These tasks are sequential as they depend on mismatch analysis

- [ ] T022 Filter mismatches to only those with fixConfidence >= 80 (high confidence fixes)
- [ ] T023 For each fixable mismatch, generate `FixStrategy` including:
  - Regex pattern to match the problematic code
  - Replacement string with backreferences
  - Before/after code examples
- [ ] T024 Group fixable mismatches by file path
- [ ] T025 Within each file, sort mismatches by line number (descending order to avoid offset issues)
- [ ] T026 Export fix plan to `specs/002-serena/fix-plan.json`

**Deliverable**: Fix plan with ~8-15 high-confidence fixes

**Checkpoint**: Fix strategies generated and validated

---

## Phase 5: Fix Application

**Purpose**: Apply fixes file-by-file with verification gates

**Note**: Process ONE file at a time (not parallel) to enable rollback on errors

- [ ] T027 For first file in fix plan, iterate through its mismatches:
  - Generate regex pattern and replacement from `FixStrategy`
  - Call Serena `replace_regex` with `relative_path`, `regex`, `repl`, `allow_multiple_occurrences: false`
  - Record success as `AppliedFix` or failure as `ManualReviewItem`
- [ ] T028 After all fixes in file, verify TypeScript compilation: `npx tsc --noEmit --project tsconfig.json`
- [ ] T029 If type errors introduced, rollback file: `git checkout src/path/to/file.ts` and flag all fixes as manual review
- [ ] T030 If verification passes, commit file: `git add <file> && git commit -m "fix: correct function arguments in <file>"`
- [ ] T031 Repeat T027-T030 for each subsequent file in fix plan
- [ ] T032 Export applied fixes to `specs/002-serena/applied-fixes.json`
- [ ] T033 Export manual review items to `specs/002-serena/manual-review.csv`

**Deliverable**: Fixed source files, applied fixes log, manual review list

**Checkpoint**: All fixable mismatches applied or flagged for review

---

## Phase 6: Comprehensive Verification

**Purpose**: Ensure all fixes are correct and no new errors introduced

**Note**: These verification tasks can run in parallel

- [ ] T034 [P] Run full TypeScript compilation: `npx tsc --noEmit 2>&1 | tee type-check-result.txt`
- [ ] T035 [P] Run Biome checks: `bun run check 2>&1 | tee lint-result.txt`
- [ ] T036 [P] Run unit test suite: `bun test 2>&1 | tee test-result.txt`
- [ ] T037 Run build process: `bun run build 2>&1 | tee build-result.txt`
- [ ] T038 Compare results against baseline (baseline-errors.txt, baseline-lint.txt)
- [ ] T039 Generate verification report showing:
  - Type errors: baseline vs current
  - Lint errors: baseline vs current
  - Test failures: baseline vs current
  - Build status: success/failure
- [ ] T040 If any verification fails with NEW errors (not in baseline), investigate and fix or rollback

**Deliverable**: Verification report

**Checkpoint**: All verification checks pass or match baseline

---

## Phase 7: Reporting & Documentation

**Purpose**: Generate comprehensive fix report and manual review guidance

- [ ] T041 Generate human-readable fix report `specs/002-serena/fix-report.md` including:
  - Executive summary (functions analyzed, call sites found, mismatches fixed)
  - Breakdown by file (mismatches, fixes, status)
  - Breakdown by function (call sites, issues, fixes)
  - List of manual review items with file paths and line numbers
  - Verification results (TypeScript, linting, tests, build)
- [ ] T042 Generate machine-readable fix report `specs/002-serena/fix-report.json` with complete `FixReport` structure
- [ ] T043 Generate manual review spreadsheet `specs/002-serena/manual-review.csv` for easy review in spreadsheet app
- [ ] T044 Update `specs/002-serena/plan.md` with "Implementation Complete" section documenting:
  - Actual scope (functions, call sites, mismatches found)
  - Fixes applied vs manual review needed
  - Time taken per phase
  - Any deviations from plan
- [ ] T045 Create summary commit message documenting all changes made

**Deliverable**: Complete fix report suite

**Checkpoint**: All documentation complete

---

## Phase 8: Final Validation & Cleanup

**Purpose**: Final checks before considering task complete

- [ ] T046 Review manual review items in `manual-review.csv` and document any that need immediate attention
- [ ] T047 Run complete quickstart validation from `quickstart.md` success criteria:
  - [ ] `db/db.ts` removed
  - [ ] Zero TypeScript argument-related errors
  - [ ] All tests passing
  - [ ] Build succeeds
  - [ ] Fix report generated
  - [ ] Manual review items documented
- [ ] T048 If any quickstart criteria fail, address issues before closing
- [ ] T049 Delete backup branch if no longer needed: `git branch -D 002-serena-backup`
- [ ] T050 Mark all tasks in this file as complete

**Checkpoint**: Feature complete and ready for PR or merge

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Function Discovery) - Tasks T007-T010 can run in parallel [P]
    ↓
Phase 3 (Call Site Discovery & Analysis) - Sequential
    ↓
Phase 4 (Fix Strategy Generation) - Sequential
    ↓
Phase 5 (Fix Application) - Sequential (one file at a time)
    ↓
Phase 6 (Verification) - Tasks T034-T036 can run in parallel [P]
    ↓
Phase 7 (Reporting) - Sequential
    ↓
Phase 8 (Final Validation) - Sequential
```

### Critical Path

1. T001-T006: Setup (5 min)
2. T007-T012: Function Discovery (10 min)
3. T013-T021: Call Site Analysis (15 min)
4. T022-T026: Fix Strategy (5 min)
5. T027-T033: Fix Application (20 min)
6. T034-T040: Verification (10 min)
7. T041-T045: Reporting (5 min)
8. T046-T050: Final Validation (5 min)

**Total Estimated Time**: ~75 minutes

### Parallel Opportunities

**Phase 2 (Function Discovery)**:
```bash
# Run these 4 tasks in parallel:
Task: "Discover functions in src/lib using Serena find_symbol"
Task: "Discover functions in src/services using Serena find_symbol"
Task: "Discover functions in src/routes/api using Serena find_symbol"
Task: "Discover functions in src/db/index.ts using Serena find_symbol"
```

**Phase 6 (Verification)**:
```bash
# Run these 3 tasks in parallel:
Task: "Run full TypeScript compilation: npx tsc --noEmit"
Task: "Run Biome checks: bun run check"
Task: "Run unit test suite: bun test"
```

---

## Implementation Strategy

### Sequential Approach (Recommended)

Follow phases 1-8 in order. This is the safest approach and ensures proper verification at each gate.

### Partial Implementation

You can stop after Phase 1 (Setup) if you only want to remove the duplicate `db/db.ts` file and verify the codebase is clean.

### Resume Strategy

If interrupted, you can resume from any phase by:
1. Reading the exported JSON files (function-catalog.json, callsite-catalog.json, mismatch-report.json, fix-plan.json)
2. Continuing from the next incomplete task

---

## Success Criteria (from spec.md)

- [ ] **SC-001**: TypeScript compilation succeeds without argument-related type errors
- [ ] **SC-002**: All function calls match declarations (argument count and order)
- [ ] **SC-003**: Automated fixes don't introduce new errors (tests pass)
- [ ] **SC-004**: Fix report documents all changes (100% coverage)
- [ ] **SC-005**: Codebase builds successfully with `bun run build`

**Acceptance**: All 5 criteria must be met for feature completion.

---

## Risk Mitigation Reminders

| Risk | Mitigation (Task Reference) |
|------|----------------------------|
| False positives | T022 filters to confidence >= 80%, T028 verifies each file |
| TypeScript errors | T029 rollback mechanism, T034-T040 comprehensive verification |
| Serena timeouts | T007-T010 batch by directory, 60s timeout per tool call |
| Breaking tests | T036 test suite validation, T029 rollback on failure |

---

## Notes

- This is a ONE-TIME migration/refactoring task, not a recurring operation
- The main actionable finding from research is removing duplicate `src/db/db.ts`
- Actual scope may be smaller than estimated if no function argument mismatches exist
- All Serena tool calls should use the activated `solid-imager` project
- Preserve exact code formatting (indentation, spacing) when applying fixes
- Commit after each file fix (T030) to enable granular rollback
- If > 5 items flagged for manual review, consider lower confidence threshold or more sophisticated fix strategies

---

## References

- [Feature Specification](./spec.md) - User stories and requirements
- [Implementation Plan](./plan.md) - Technical approach and timeline
- [Research Findings](./research.md) - Codebase analysis
- [Data Model](./data-model.md) - Data structures used
- [Quickstart Guide](./quickstart.md) - Step-by-step walkthrough
- [Serena Contracts](./contracts/serena-analysis.md) - Tool interface specifications

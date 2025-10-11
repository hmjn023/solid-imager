# Quickstart: Function Argument Correction

**Feature**: Function Argument Correction Using Serena
**Estimated Time**: 30-60 minutes
**Complexity**: Medium

## Prerequisites

1. **Serena MCP Server** is active and connected
2. **Project activated**: `solid-imager` project must be active in Serena
3. **Git clean state**: Commit or stash current changes
4. **Backup**: Create a git branch for safety

```bash
git checkout -b 002-serena-backup
git checkout 002-serena
```

## Quick Start (5 steps)

### Step 1: Remove Duplicate Database Module (5 min)

The codebase has a duplicate `db/db.ts` file that conflicts with `db/index.ts`.

**Action**:
```bash
# Verify db/db.ts is not imported anywhere
grep -r "from.*db/db" src/

# If no results, safe to delete
rm src/db/db.ts

# Verify build still works
bun run check
```

**Expected**: No imports found, file deleted, build passes.

### Step 2: Discover All Functions (10 min)

Use Serena to catalog all functions and methods in the project.

**Action**:
```typescript
// Find all functions in lib/, services/, and routes/api/
const functions = await mcp__serena__find_symbol({
  name_path: "/",
  relative_path: "src/lib",
  include_kinds: [12],  // Functions only
  include_body: true,
  depth: 0
});

// Repeat for src/services and src/routes/api
// Store results in a collection
```

**Expected**: ~100-200 function declarations found.

### Step 3: Find Call Sites (15 min)

For each function, find all places it's called.

**Action**:
```typescript
for (const func of functions) {
  const refs = await mcp__serena__find_referencing_symbols({
    name_path: func.name_path,
    relative_path: func.relative_path
  });

  // Analyze each reference
  for (const ref of refs) {
    // Parse ref.snippet to extract arguments
    // Compare with func parameters
    // Flag mismatches
  }
}
```

**Expected**: ~500-1000 call sites analyzed, ~10-50 mismatches found.

### Step 4: Apply Fixes (20 min)

For each fixable mismatch, generate and apply a fix.

**Action**:
```typescript
for (const mismatch of fixableMismatches) {
  const { regex, replacement } = generateFixStrategy(mismatch);

  await mcp__serena__replace_regex({
    relative_path: mismatch.callSite.filePath,
    regex,
    repl: replacement,
    allow_multiple_occurrences: false
  });

  // Verify after each fix
  await runTypeCheck();
}
```

**Expected**: ~8-15 fixes applied successfully.

### Step 5: Verify and Report (10 min)

Run final verification and generate report.

**Action**:
```bash
# Type check
npx tsc --noEmit

# Lint check
bun run check

# Run tests
bun test

# Build
bun run build
```

**Expected**: All checks pass, build succeeds.

## Detailed Walkthrough

### Phase 1: Setup and Preparation

1. **Activate Serena project**:
   ```typescript
   await mcp__serena__activate_project({ project: "solid-imager" });
   ```

2. **Verify clean state**:
   ```bash
   git status  # Should show no uncommitted changes on 002-serena branch
   ```

3. **Run baseline checks**:
   ```bash
   npx tsc --noEmit > baseline-errors.txt
   bun run check > baseline-lint.txt
   ```

### Phase 2: Function Discovery

**Goal**: Build complete catalog of all functions in the project.

**Files to scan**:
- `src/lib/**/*.ts` - API client functions
- `src/services/**/*.ts` - Business logic
- `src/routes/api/**/*.ts` - HTTP handlers
- `src/db/index.ts` - Database functions

**Exclude**:
- `src/tests/**` - Test files
- `src/components/**` - UI components (React/Solid)
- `node_modules/**` - External dependencies

**Sample code**:
```typescript
const directories = ['src/lib', 'src/services', 'src/routes/api', 'src/db'];
const allFunctions: FunctionSignature[] = [];

for (const dir of directories) {
  const result = await mcp__serena__find_symbol({
    name_path: "/",
    relative_path: dir,
    include_kinds: [12, 6],  // Functions and Methods
    include_body: true,
    depth: 1  // Include class methods
  });

  for (const symbol of result.symbols) {
    // Parse symbol.body to extract parameters
    const params = parseParameters(symbol.body);

    allFunctions.push({
      id: `${symbol.relative_path}:${symbol.name_path}`,
      name: symbol.name_path.split('/').pop(),
      namePath: symbol.name_path,
      kind: symbol.kind,
      filePath: symbol.relative_path,
      startLine: symbol.body_location.start_line,
      endLine: symbol.body_location.end_line,
      parameters: params,
      isAsync: symbol.body.includes('async '),
      isExported: symbol.body.includes('export ')
    });
  }
}

console.log(`Found ${allFunctions.length} functions`);
```

### Phase 3: Call Site Analysis

**Goal**: Find all invocations of each function and validate arguments.

**Sample code**:
```typescript
const allCallSites: CallSite[] = [];
const mismatches: ArgumentMismatch[] = [];

for (const func of allFunctions) {
  const refs = await mcp__serena__find_referencing_symbols({
    name_path: func.name,
    relative_path: func.filePath
  });

  for (const ref of refs.references) {
    // Parse snippet to extract call arguments
    const callMatch = ref.snippet.match(
      new RegExp(`${func.name}\\(([^)]*)\\)`)
    );

    if (!callMatch) continue;

    const argsText = callMatch[1];
    const args = parseArguments(argsText);

    const callSite: CallSite = {
      id: `${ref.relative_path}:${ref.name_path}`,
      functionId: func.id,
      filePath: ref.relative_path,
      line: extractLineNumber(ref.snippet),
      column: 0,
      codeSnippet: ref.snippet,
      arguments: args
    };

    allCallSites.push(callSite);

    // Validate arguments against parameters
    const mismatch = validateCallSite(func, callSite);
    if (mismatch) {
      mismatches.push(mismatch);
    }
  }
}

console.log(`Found ${allCallSites.length} call sites`);
console.log(`Found ${mismatches.length} mismatches`);
```

### Phase 4: Fix Application

**Goal**: Automatically fix all high-confidence mismatches.

**Strategy**:
1. Sort mismatches by confidence (high → low)
2. Group by file
3. Process one file at a time
4. Verify after each file

**Sample code**:
```typescript
// Group fixable mismatches by file
const byFile = groupBy(
  mismatches.filter(m => m.fixable && m.fixConfidence >= 80),
  m => m.callSiteId.split(':')[0]
);

for (const [filePath, fileMismatches] of Object.entries(byFile)) {
  console.log(`\nFixing ${fileMismatches.length} issues in ${filePath}`);

  // Sort by line number (descending) to avoid offset issues
  fileMismatches.sort((a, b) => b.line - a.line);

  for (const mismatch of fileMismatches) {
    try {
      const { regex, replacement } = mismatch.fixStrategy!;

      await mcp__serena__replace_regex({
        relative_path: filePath,
        regex,
        repl: replacement,
        allow_multiple_occurrences: false
      });

      console.log(`  ✓ Fixed ${mismatch.type} at line ${mismatch.line}`);

      // Record success
      appliedFixes.push({
        mismatchId: mismatch.id,
        filePath,
        line: mismatch.line,
        before: mismatch.actualCall,
        after: mismatch.expectedSignature,
        fixType: mismatch.fixStrategy!.type,
        appliedAt: new Date()
      });

    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);

      // Flag for manual review
      manualReviewItems.push({
        mismatchId: mismatch.id,
        severity: mismatch.severity,
        filePath,
        line: mismatch.line,
        reason: error.message,
        codeSnippet: mismatch.actualCall
      });
    }
  }

  // Verify file after fixes
  const typeCheck = await runTypeCheckOnFile(filePath);
  if (!typeCheck.success) {
    console.log(`  ⚠ Type errors introduced, review needed`);
    // Optionally rollback
  }
}
```

### Phase 5: Verification

**Goal**: Ensure all fixes are correct and no new errors introduced.

**Checks**:
1. TypeScript compilation
2. Biome linting
3. Unit tests
4. Build process

**Sample code**:
```bash
# Full verification suite
echo "Running verification..."

# 1. TypeScript
npx tsc --noEmit 2>&1 | tee type-check-result.txt
TYPE_ERRORS=$(grep -c "error TS" type-check-result.txt || echo "0")

# 2. Linting
bun run check 2>&1 | tee lint-result.txt
LINT_ERRORS=$(grep -c "error" lint-result.txt || echo "0")

# 3. Tests
bun test 2>&1 | tee test-result.txt
TEST_FAILURES=$(grep -c "FAIL" test-result.txt || echo "0")

# 4. Build
bun run build 2>&1 | tee build-result.txt
BUILD_SUCCESS=$?

# Report
echo "===== Verification Results ====="
echo "Type errors: $TYPE_ERRORS"
echo "Lint errors: $LINT_ERRORS"
echo "Test failures: $TEST_FAILURES"
echo "Build success: $BUILD_SUCCESS"
```

### Phase 6: Reporting

**Goal**: Generate comprehensive report of all changes.

**Outputs**:
1. `fix-report.md` - Human-readable summary
2. `fix-report.json` - Machine-readable data
3. `manual-review.csv` - Items needing review

**Sample report structure**:
```markdown
# Function Argument Correction Report

**Date**: 2025-10-11
**Branch**: 002-serena
**Duration**: 45 minutes

## Summary

- Functions analyzed: 150
- Call sites found: 875
- Mismatches found: 23
- Fixes applied: 18
- Manual review needed: 5

## By File

### src/lib/api/sources.ts
- Mismatches: 3
- Fixes: 3
- Status: ✓ Clean

### src/services/media-service.ts
- Mismatches: 5
- Fixes: 4
- Manual review: 1

## Manual Review Items

1. `src/routes/api/sources/[sourceId]/index.ts:42`
   - Reason: Complex spread operator
   - Suggestion: Review argument destructuring

## Verification

- ✓ TypeScript compilation: 0 errors
- ✓ Biome linting: 0 errors
- ✓ Tests: All passing
- ✓ Build: Successful
```

## Common Issues

### Issue: "Pattern matches multiple occurrences"

**Cause**: Regex pattern is too generic.

**Solution**: Add more context to make pattern unique:
```typescript
// Too generic
regex: "insertMedia\\((.+)\\)"

// Better - include context
regex: "const result = await insertMedia\\((.+)\\)"
```

### Issue: "Type errors after fix"

**Cause**: Argument types still incompatible.

**Solution**: Rollback and flag for manual review:
```bash
git checkout src/path/to/file.ts
# Add to manual review list
```

### Issue: "Serena timeout"

**Cause**: Too many symbols in one call.

**Solution**: Process in smaller batches:
```typescript
// Instead of scanning entire src/
// Scan subdirectories separately
for (const subdir of ['src/lib', 'src/services', ...]) {
  // Process subdir
}
```

## Success Criteria

- [ ] `db/db.ts` removed
- [ ] Zero TypeScript argument-related errors
- [ ] All tests passing
- [ ] Build succeeds
- [ ] Fix report generated
- [ ] Manual review items documented

## Next Steps

After completing this quickstart:

1. **Review manual items**: Address the 5-10 items flagged for manual review
2. **Run full test suite**: `bun test` to ensure no regressions
3. **Update documentation**: Document any API changes made
4. **Create PR**: Push branch and create pull request with fix report

## Getting Help

- **Serena docs**: Check Serena MCP server documentation
- **Spec reference**: See `spec.md` for requirements
- **Data model**: See `data-model.md` for type definitions
- **Contracts**: See `contracts/` for Serena interface details

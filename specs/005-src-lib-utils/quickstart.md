# Migration Quickstart Guide

**Feature**: Reorganize src/lib and src/utils Architecture
**Branch**: `005-src-lib-utils`

This guide provides step-by-step verification procedures for the architecture migration.

## Pre-Migration Checklist

Before starting the migration, verify:

```bash
# 1. Ensure you're on the feature branch
git branch --show-current
# Expected: 005-src-lib-utils

# 2. Ensure all tests pass
bun run test
# Expected: All tests pass

# 3. Ensure type checking passes
bun run check
# Expected: No errors

# 4. Ensure linting passes
bun run lint
# Expected: No errors (or only expected warnings)

# 5. Record baseline metrics
echo "Files in src/lib:" && find src/lib -type f | wc -l
echo "Files in src/services:" && find src/services -type f | wc -l
echo "Total lines in lib/helpers:" && find src/lib/helpers -name "*.ts" -exec wc -l {} + | tail -1
```

**If any pre-migration check fails, do not proceed. Fix issues first.**

## Migration Phases

### Phase 1: Create Directory Structure

```bash
# Create new directory structure (empty directories)
mkdir -p src/domain/media/processing
mkdir -p src/domain/media/utils
mkdir -p src/domain/sources
mkdir -p src/domain/tags
mkdir -p src/domain/categories
mkdir -p src/domain/characters
mkdir -p src/domain/ips
mkdir -p src/domain/shared
mkdir -p src/application/services
mkdir -p src/infrastructure/storage
mkdir -p src/infrastructure/api-clients
mkdir -p src/infrastructure/jobs
mkdir -p src/infrastructure/db
mkdir -p src/presentation/routes
mkdir -p src/presentation/components
mkdir -p src/presentation/utils
mkdir -p src/shared/types
mkdir -p src/shared/constants

# Verify structure created
tree -L 3 -d src/
```

**Validation**: Build should still succeed (empty directories don't break anything)

```bash
bun run check
# Expected: No errors (same as before)
```

**Git checkpoint:**
```bash
git add src/
git commit -m "chore: create new directory structure for layered architecture"
```

### Phase 2: Migrate Domain Layer

**What to migrate**:
- Types and schemas split by domain
- Pure business logic functions
- Media processing utilities

**Files to create/move**:
1. `src/domain/media/types.ts` - Extract media-related types from `src/lib/types.ts`
2. `src/domain/media/schemas.ts` - Extract media schemas from `src/lib/schemas.ts`
3. `src/domain/sources/types.ts` - Extract source types
4. `src/domain/sources/schemas.ts` - Extract source schemas
5. `src/domain/tags/types.ts` - Extract tag types
6. `src/domain/tags/schemas.ts` - Extract tag schemas
7. `src/domain/categories/types.ts` - Extract category types
8. `src/domain/categories/schemas.ts` - Extract category schemas
9. `src/domain/characters/types.ts` - Extract character types
10. `src/domain/characters/schemas.ts` - Extract character schemas
11. `src/domain/ips/types.ts` - Extract IP types
12. `src/domain/ips/schemas.ts` - Extract IP schemas
13. `src/domain/shared/types.ts` - Cross-domain types
14. `src/domain/shared/validation.ts` - From `lib/helpers/data-transformer.ts`
15. `src/domain/media/processing/image-processor.ts` - From `lib/helpers/image-processor.ts`
16. `src/domain/media/processing/thumbnail-generator.ts` - From `lib/thumbnails.ts`
17. `src/domain/media/utils/path-utils.ts` - From `lib/helpers/utils.ts` (PathUtils)
18. `src/domain/media/utils/hash-utils.ts` - From `lib/helpers/utils.ts` (HashUtils)

**Validation after domain layer migration**:

```bash
# Run type checking to find import errors
bun run check
# Fix any import errors in domain files

# Run unit tests
bun run test:unit
# Expected: All unit tests pass

# Verify domain layer has no infrastructure dependencies
grep -r "infrastructure\|api-clients\|storage\|jobs" src/domain/
# Expected: No matches (domain should not import infrastructure)
```

**Git checkpoint:**
```bash
git add src/domain/
git commit -m "refactor: migrate domain layer (types, schemas, pure functions)"
```

### Phase 3: Migrate Infrastructure Layer

**What to migrate**:
- Storage drivers
- API client functions
- Background job infrastructure
- Database files (move from src/db)

**Files to create/move**:
1. `src/infrastructure/storage/types.ts` - From `lib/drivers/types.ts`
2. `src/infrastructure/storage/factory.ts` - From `lib/drivers/factory.ts`
3. `src/infrastructure/storage/local.ts` - From `lib/drivers/local.ts`
4. `src/infrastructure/storage/sftp.ts` - Extract from `lib/helpers/storage-drivers.ts`
5. `src/infrastructure/storage/s3.ts` - Extract from `lib/helpers/storage-drivers.ts`
6. `src/infrastructure/api-clients/*.ts` - From `lib/api/*.ts` (API client parts only)
7. `src/infrastructure/jobs/job-queue.ts` - From `lib/helpers/job-queue.ts`
8. `src/infrastructure/jobs/sse-manager.ts` - Extract from `lib/helpers/job-queue.ts`
9. `src/infrastructure/jobs/thumbnail-jobs.ts` - From `services/thumbnail-jobs.ts`
10. `src/infrastructure/db/index.ts` - From `db/index.ts`
11. `src/infrastructure/db/schema.ts` - From `db/schema.ts`

**Special handling**:
- `lib/api/media.ts` contains business logic - split it:
  - Business logic → Already in `services/media-service.ts` (don't duplicate)
  - API client functions only → `infrastructure/api-clients/media.ts`

**Validation after infrastructure layer migration**:

```bash
# Run type checking
bun run check
# Fix any import errors

# Run integration tests
bun run test:integration
# Expected: All integration tests pass

# Verify infrastructure can import domain but not application
grep -r "application/services" src/infrastructure/
# Expected: No matches (infrastructure should not import application layer)
```

**Git checkpoint:**
```bash
git add src/infrastructure/
git commit -m "refactor: migrate infrastructure layer (storage, API clients, jobs, db)"
```

### Phase 4: Migrate Application Layer

**What to migrate**:
- Service files from `src/services/` to `src/application/services/`

**Files to move**:
```bash
# Move all service files
mv src/services/*.ts src/application/services/
# Except thumbnail-jobs.ts which already moved to infrastructure
```

**Update imports in services**:
- Change imports from `~/lib/` to `~/domain/` or `~/infrastructure/`
- Change imports from `~/services/` to `~/application/services/`
- Change imports from `~/db` to `~/infrastructure/db`

**Validation after application layer migration**:

```bash
# Run type checking
bun run check
# Fix any import errors

# Run service tests
bun run test src/tests/unit/ src/tests/integration/
# Expected: All tests pass
```

**Git checkpoint:**
```bash
git add src/application/ src/services/
git commit -m "refactor: migrate application layer (services)"
```

### Phase 5: Migrate Presentation Layer

**What to migrate**:
- `src/lib/utils.ts` (cn function) → `src/presentation/utils/cn.ts`
- Update route imports
- Update component imports

**Files to create**:
1. `src/presentation/utils/cn.ts` - From `lib/utils.ts`

**Note**: Routes and components stay in their current locations (`src/routes/`, `src/components/`) but conceptually belong to presentation layer.

**Update imports across presentation layer**:
- Routes: Update imports from `~/lib/` to new paths
- Components: Update imports from `~/lib/` to new paths

**Validation after presentation layer migration**:

```bash
# Run type checking
bun run check
# Fix any import errors

# Run all tests including e2e
bun run test
# Expected: All tests pass

# Verify imports are using new paths
grep -r "~/lib/" src/routes/ src/components/
# Expected: No matches (all should use new paths)
```

**Git checkpoint:**
```bash
git add src/presentation/ src/routes/ src/components/
git commit -m "refactor: migrate presentation layer utilities and update imports"
```

### Phase 6: Update Test Imports

**What to update**:
- All test files importing from old paths

**Strategy**:
```bash
# Find all test files with old imports
grep -r "from.*~/lib/" src/tests/
grep -r "from.*~/services/" src/tests/
grep -r "from.*~/db" src/tests/

# Update systematically:
# ~/lib/types -> ~/domain/[domain]/types
# ~/lib/schemas -> ~/domain/[domain]/schemas
# ~/lib/api/* -> ~/infrastructure/api-clients/*
# ~/lib/drivers/* -> ~/infrastructure/storage/*
# ~/lib/helpers/* -> ~/domain/* or ~/infrastructure/*
# ~/lib/thumbnails -> ~/domain/media/processing/thumbnail-generator
# ~/lib/utils -> ~/presentation/utils/cn
# ~/services/* -> ~/application/services/*
# ~/db -> ~/infrastructure/db
```

**Validation after test import updates**:

```bash
# Run full test suite
bun run test
# Expected: All tests pass (100% pass rate)

# Run type checking
bun run check
# Expected: No errors
```

**Git checkpoint:**
```bash
git add src/tests/
git commit -m "refactor: update test imports to new architecture paths"
```

### Phase 7: Clean Up Old Directories

**What to remove**:
- `src/lib/` (entire directory)
- `src/services/` (should be empty after move)
- `src/utils/` (empty directory)
- `src/db/` (moved to infrastructure)

**Before removing, verify no references remain**:

```bash
# Search for old import paths across entire codebase
grep -r "from.*~/lib/" src/
grep -r "from.*~/services/" src/ --exclude-dir=application
grep -r "from.*~/db" src/ --exclude-dir=infrastructure

# If any found, fix them first before proceeding
```

**Remove old directories**:

```bash
# Only remove if verification above showed zero matches
rm -rf src/lib/
rm -rf src/services/
rm -rf src/utils/
rm -rf src/db/

# Verify clean removal
tree -L 2 -d src/
```

**Validation after cleanup**:

```bash
# Full validation suite
bun run check     # No TypeScript errors
bun run lint      # No lint errors
bun run test      # All tests pass
bun run build     # Build succeeds

# Verify no broken imports
grep -r "~/lib/\|~/services/\|~/db" src/ --exclude-dir=node_modules
# Expected: No matches
```

**Git checkpoint:**
```bash
git add -A
git commit -m "refactor: remove old directory structure after migration"
```

## Post-Migration Validation

Run complete validation suite:

```bash
# 1. Type checking
bun run check
echo "✓ Type checking passed"

# 2. Linting
bun run lint
echo "✓ Linting passed"

# 3. Unit tests
bun run test:unit
echo "✓ Unit tests passed"

# 4. Integration tests
bun run test:integration
echo "✓ Integration tests passed"

# 5. E2E tests
bun run test:e2e
echo "✓ E2E tests passed"

# 6. Build
bun run build
echo "✓ Build succeeded"

# 7. Verify new structure
tree -L 3 -d src/ | head -50
echo "✓ New structure in place"

# 8. Check for architectural violations
echo "Checking domain layer purity..."
grep -r "infrastructure\|application/services" src/domain/ && echo "❌ VIOLATION FOUND" || echo "✓ No violations"

echo "Checking infrastructure independence from application..."
grep -r "application/services" src/infrastructure/ && echo "❌ VIOLATION FOUND" || echo "✓ No violations"
```

**Success criteria**:
- ✅ All tests pass (100%)
- ✅ No TypeScript errors
- ✅ No lint errors
- ✅ Build succeeds
- ✅ No architectural violations (domain doesn't import infrastructure, etc.)

## Rollback Procedure

If migration fails at any phase:

```bash
# 1. Check current status
git status
git log --oneline -5

# 2. Rollback to last successful checkpoint
git reset --hard <commit-hash-of-last-good-checkpoint>

# 3. Verify rollback successful
bun run test
bun run check

# 4. Analyze what went wrong
# - Review error messages
# - Check which imports weren't updated
# - Identify missing file moves

# 5. Fix issues in isolation before re-attempting
```

## Common Issues and Solutions

### Issue: TypeScript can't find module

**Symptom**:
```
Cannot find module '~/domain/media/types' or its corresponding type declarations.
```

**Solution**:
1. Verify file exists at expected path
2. Check tsconfig.json path mappings
3. Restart TypeScript server
4. Verify exports in the module

### Issue: Tests failing after migration

**Symptom**:
```
Test suite failed to run: Cannot find module '~/lib/api/media'
```

**Solution**:
1. Update test imports to new paths
2. Check if file was moved to correct location
3. Verify test is importing correct symbols

### Issue: Circular dependency detected

**Symptom**:
```
Warning: Circular dependency detected between domain/media/types and infrastructure/storage/types
```

**Solution**:
1. Review dependency direction (should be presentation → application → domain ← infrastructure)
2. Extract shared types to `domain/shared/types.ts`
3. Use dependency inversion (interfaces in domain, implementations in infrastructure)

### Issue: Build succeeds but tests fail

**Symptom**:
Build passes but some tests fail with import errors.

**Solution**:
1. Check if test files were updated
2. Verify test setup files have correct imports
3. Run tests with `--no-cache` flag

## Metrics Tracking

Track these metrics before and after migration:

```bash
# Before migration (run in main branch)
echo "=== BEFORE MIGRATION ===" > migration-metrics.txt
echo "Files in src/lib: $(find src/lib -type f | wc -l)" >> migration-metrics.txt
echo "Total lines in src/lib: $(find src/lib -name "*.ts" -exec wc -l {} + | tail -1)" >> migration-metrics.txt
echo "Test pass rate: $(bun run test --reporter=json | jq '.success')" >> migration-metrics.txt

# After migration (run in feature branch)
echo "=== AFTER MIGRATION ===" >> migration-metrics.txt
echo "Files in src/domain: $(find src/domain -type f | wc -l)" >> migration-metrics.txt
echo "Files in src/infrastructure: $(find src/infrastructure -type f | wc -l)" >> migration-metrics.txt
echo "Files in src/application: $(find src/application -type f | wc -l)" >> migration-metrics.txt
echo "Test pass rate: $(bun run test --reporter=json | jq '.success')" >> migration-metrics.txt
echo "Architectural layers: $(ls -d src/*/ | grep -E 'domain|application|infrastructure|presentation' | wc -l)" >> migration-metrics.txt

cat migration-metrics.txt
```

**Target metrics**:
- Test pass rate: 100% (same as before)
- Build time: ≤ previous build time
- Code duplication: Reduced by 20%+
- Architectural layers: 4 (domain, application, infrastructure, presentation)

## Next Steps

After successful migration:

1. **Create PR** with migration changes
2. **Request code review** focusing on:
   - Architecture compliance
   - Import correctness
   - Test coverage maintained
3. **Update documentation**:
   - Add architecture decision record (ADR)
   - Update README with new structure
   - Create developer guide for adding new features
4. **Announce to team** the new structure and guidelines

## Additional Resources

- [Specification](./spec.md) - Original feature requirements
- [Implementation Plan](./plan.md) - Detailed technical plan
- [Clean Architecture Guide](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SolidStart Documentation](https://start.solidjs.com/)

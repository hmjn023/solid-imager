# Quickstart: Skeleton Test Implementation

**Feature**: Skeleton Test Implementation
**Estimated Time**: 45-60 minutes
**Complexity**: Medium

## Prerequisites

1. **Serena MCP Server** is active and connected
2. **Project activated**: `solid-imager` project must be active in Serena
3. **Git clean state**: Commit or stash current changes
4. **Bun installed**: Test runner and package manager

```bash
# Verify prerequisites
serena status           # Should show "active"
git status              # Should show clean or committed
bun --version           # Should show 1.x
```

## Quick Start (5 Steps)

### Step 1: Discover Untested API Routes (5 min)

Identify which API routes lack test coverage.

**Action**:
```bash
# Count API routes
find src/routes/api -type f -name "*.ts" | wc -l
# Result: 32

# Count test files
find src/tests -name "*.test.ts" -o -name "*.spec.ts" | wc -l
# Result: 31

# Identify gaps
./scripts/check-test-coverage.sh
```

**Expected**: ~13 routes without tests identified.

### Step 2: Generate Skeleton Tests (20 min)

Create skeleton test files for all untested routes.

**Action**:
```typescript
import { discoverAPIRoutes, generateSkeletonTest, writeTestFile } from "./generators";

// Discover all routes
const discovery = await discoverAPIRoutes({
  baseDir: "src/routes/api",
  recursive: true,
  extensions: [".ts"],
  exclude: ["*.test.ts", "*.spec.ts"]
});

// Filter to untested routes
const untested = discovery.routes.filter(r => !r.hasTest);

console.log(`Generating ${untested.length} skeleton tests...`);

// Generate each skeleton test
for (const route of untested) {
  try {
    const skeleton = await generateSkeletonTest({
      route,
      templateDir: "./.specify/templates/tests",
      options: {
        includeSchemaValidation: true,
        includeAuthTests: false,
        includeEdgeCases: true,
        testCasesPerMethod: 3,
        useMockData: true
      }
    });

    await writeTestFile({
      skeleton,
      overwrite: false,
      dryRun: false
    });

    console.log(`✓ Generated: ${skeleton.relativePath}`);
  } catch (error) {
    console.error(`✗ Failed for ${route.id}: ${error.message}`);
  }
}
```

**Expected**: 13 new test files created in `src/tests/api/`.

### Step 3: Handle Duplicate Tests (10 min)

Merge duplicate test files (camelCase vs kebab-case).

**Action**:
```typescript
import { findDuplicates, mergeDuplicate } from "./generators";

// Find all duplicate pairs
const { duplicatePairs } = await findDuplicates({
  testBaseDir: "src/tests",
  patterns: ["**/*.test.ts", "**/*.spec.ts"]
});

console.log(`Found ${duplicatePairs.length} duplicate pairs`);

// Merge each pair
for (const pair of duplicatePairs) {
  const result = await mergeDuplicate({
    pair,
    keepVersion: "kebab",
    dryRun: false
  });

  if (result.success) {
    console.log(`✓ Merged: ${path.basename(pair.camelCasePath)} → ${path.basename(pair.kebabCasePath)}`);
    if (result.testsAdded > 0) {
      console.log(`  Added ${result.testsAdded} unique tests`);
    }
  } else {
    console.error(`✗ Failed to merge: ${pair.camelCasePath}`);
  }
}
```

**Expected**: 11 duplicate pairs merged, 11 camelCase files deleted.

### Step 4: Verify Tests Pass (5 min)

Run test suite to ensure all skeleton tests are valid.

**Action**:
```bash
# Run all tests
bun test

# Expected output:
# ✓ All existing tests pass
# ✓ New skeleton tests pass (with TODOs)
# ⚠ Many TODO markers for unimplemented functionality

# Check for syntax errors
bun run check

# Expected: No TypeScript errors
```

**Expected**: All tests pass, clear TODO markers visible.

### Step 5: Generate Coverage Report (5 min)

Create documentation of what was generated.

**Action**:
```typescript
import { generateReport } from "./generators";

const report = await generateReport({
  discovery,
  testCheck,
  generated: skeletonTests,
  duplicates: duplicatePairs,
  verification: verificationResult,
  startTime,
  endTime
});

// Export reports
await fs.writeFile("specs/003-/generation-report.json", JSON.stringify(report, null, 2));
await fs.writeFile("specs/003-/generation-report.md", renderMarkdown(report));
await fs.writeFile("specs/003-/duplicate-migration.md", renderDuplicateReport(duplicatePairs));
```

**Expected**: Three report files generated in `specs/003-/`.

## Detailed Walkthrough

### Phase 1: Setup and Discovery

#### 1.1 Activate Serena Project

```typescript
await mcp__serena__activate_project({ project: "solid-imager" });
```

#### 1.2 Discover API Routes

Use Serena to find all API route files:

```typescript
const apiFiles = await mcp__serena__list_dir({
  relative_path: "src/routes/api",
  recursive: true
});

// Filter to .ts files, exclude tests
const routeFiles = apiFiles.files
  .filter(f => f.endsWith('.ts'))
  .filter(f => !f.includes('.test.') && !f.includes('.spec.'));

console.log(`Found ${routeFiles.length} API route files`);
```

#### 1.3 Parse Each Route File

For each route file, extract HTTP methods and imports:

```typescript
for (const filePath of routeFiles) {
  const content = await mcp__serena__read_file({ relative_path: filePath });

  // Parse HTTP method exports
  const methods = extractHTTPMethods(content);  // Looks for "export async function GET", etc.

  // Parse imports
  const schemas = extractSchemaImports(content);  // From "~/lib/schemas"
  const types = extractTypeImports(content);      // From "~/db/schema"

  const apiRoute: APIRoute = {
    id: generateRouteId(filePath),
    filePath: path.resolve(filePath),
    relativePath: filePath,
    httpMethods: methods,
    routePattern: filePathToRoutePattern(filePath),
    parameters: extractParameters(filePath, content),
    hasImplementation: !content.includes("throw new Error"),
    usesAuthentication: content.includes("@authenticated") || content.includes("requireAuth"),
    importedSchemas: schemas,
    importedTypes: types,
    hasTest: false,  // Will check next
    testFilePath: null,
    complexity: determineComplexity(methods.length, content),
    priority: determinePriority(filePath, methods)
  };

  apiRoutes.push(apiRoute);
}
```

Helper functions:

```typescript
function extractHTTPMethods(content: string): HTTPMethod[] {
  const methods: HTTPMethod[] = [];
  const methodPattern = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/g;
  let match;
  while ((match = methodPattern.exec(content)) !== null) {
    methods.push(match[1] as HTTPMethod);
  }
  return methods;
}

function extractSchemaImports(content: string): string[] {
  const match = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]~\/lib\/schemas['"]/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim());
}

function filePathToRoutePattern(filePath: string): string {
  // src/routes/api/categories/index.ts → /api/categories
  // src/routes/api/categories/[id].ts → /api/categories/:id
  return filePath
    .replace('src/routes', '')
    .replace(/\/index\.ts$/, '')
    .replace(/\.ts$/, '')
    .replace(/\[(\w+)\]/g, ':$1');
}
```

### Phase 2: Check Test Existence

For each API route, check if a test file exists:

```typescript
for (const route of apiRoutes) {
  // Generate expected test path
  const testPath = route.relativePath
    .replace('src/routes/', 'src/tests/')
    .replace('.ts', '.test.ts');

  // Check if test exists
  try {
    await mcp__serena__read_file({ relative_path: testPath, limit: 1 });
    route.hasTest = true;
    route.testFilePath = testPath;
  } catch (error) {
    // File doesn't exist
    route.hasTest = false;
    route.testFilePath = null;
  }
}

const routesWithTests = apiRoutes.filter(r => r.hasTest);
const routesWithoutTests = apiRoutes.filter(r => !r.hasTest);

console.log(`Routes with tests: ${routesWithTests.length}`);
console.log(`Routes without tests: ${routesWithoutTests.length}`);
console.log(`Coverage: ${(routesWithTests.length / apiRoutes.length * 100).toFixed(1)}%`);
```

### Phase 3: Generate Skeleton Tests

#### 3.1 Load Test Template

Create a template for skeleton tests (or use existing pattern):

```typescript
const SKELETON_TEMPLATE = (route: APIRoute, method: HTTPMethod) => {
  const entityName = capitalize(route.id.split('/')[0]);
  const functionName = methodToFunction(method, entityName);
  const schemaName = route.importedSchemas[0] || null;
  const typeName = route.importedTypes[0] || entityName;

  return `
import { describe, expect, it } from "vitest";
${schemaName ? `import { ZodError } from "zod";` : ''}
${schemaName ? `import { ${schemaName} } from "~/lib/schemas";` : ''}
${typeName ? `import type { ${typeName} } from "~/db/schema";` : ''}

describe("${method} ${route.routePattern}", () => {
  ${generateTestCases(method, route, functionName, schemaName, typeName)}
});
  `.trim();
};
```

#### 3.2 Generate Test Cases by Method

```typescript
function generateTestCases(
  method: HTTPMethod,
  route: APIRoute,
  functionName: string,
  schemaName: string | null,
  typeName: string
): string {
  switch (method) {
    case "GET":
      return generateGETTests(functionName, typeName);
    case "POST":
      return generatePOSTTests(functionName, schemaName, typeName);
    case "PUT":
      return generatePUTTests(functionName, schemaName, typeName);
    case "DELETE":
      return generateDELETETests(functionName, typeName);
    default:
      return generateDefaultTests(method, functionName);
  }
}

function generateGETTests(functionName: string, typeName: string): string {
  return `
  it("should return ${typeName}[] on success", async () => {
    // TODO: Implement after ${functionName} is available
    // const result = await ${functionName}();

    // Mock response for contract testing
    const result: ${typeName}[] = [];

    expect(result).toBeInstanceOf(Array);
  });

  it("should return empty array when no items exist", async () => {
    // TODO: Test empty state
    const result: ${typeName}[] = [];
    expect(result).toEqual([]);
  });

  it("should handle query parameters correctly", async () => {
    // TODO: Test filtering, pagination, sorting
    // const result = await ${functionName}({ limit: 10 });
    // expect(result.length).toBeLessThanOrEqual(10);
  });
  `.trim();
}

function generatePOSTTests(functionName: string, schemaName: string | null, typeName: string): string {
  return `
  it("should create and return new ${typeName}", async () => {
    const newData = {
      // TODO: Fill with valid data matching schema
      name: "Test ${typeName}",
    };

    ${schemaName ? `
    // Validate with Zod schema
    ${schemaName}.parse(newData);
    ` : ''}

    // TODO: Implement after ${functionName} is available
    // const result = await ${functionName}(newData);
    const result: ${typeName} = {
      id: "mock-uuid-123",
      ...newData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(result).toBeDefined();
    expect(result.id).toBeTypeOf("string");
  });

  ${schemaName ? `
  it("should throw ZodError for invalid data", () => {
    const invalidData = {};

    expect(() => ${schemaName}.parse(invalidData)).toThrow(ZodError);
  });
  ` : ''}

  it("should reject duplicate ${typeName}s", async () => {
    // TODO: Test unique constraint
    // const data = { name: "Duplicate" };
    // await expect(${functionName}(data)).rejects.toThrow('already exists');
  });
  `.trim();
}

// Similar for PUT and DELETE...
```

#### 3.3 Write Test Files

For each untested route, generate and write the skeleton test:

```typescript
for (const route of routesWithoutTests) {
  const testFilePath = route.relativePath
    .replace('src/routes/', 'src/tests/')
    .replace('.ts', '.test.ts');

  // Ensure directory exists
  const testDir = path.dirname(testFilePath);
  await fs.mkdir(testDir, { recursive: true });

  // Generate test content
  let testContent = `// Generated skeleton test for ${route.routePattern}\n\n`;

  for (const method of route.httpMethods) {
    testContent += SKELETON_TEMPLATE(route, method) + '\n\n';
  }

  // Write file
  await fs.writeFile(testFilePath, testContent, 'utf-8');

  // Format with Biome
  await exec(`bun run biome format --write ${testFilePath}`);

  console.log(`✓ Created: ${testFilePath}`);
}
```

### Phase 4: Handle Duplicates

#### 4.1 Find Duplicate Test Files

```typescript
async function findDuplicates(baseDir: string): Promise<DuplicateTestPair[]> {
  const allTests = await glob(`${baseDir}/**/*.test.ts`);

  // Group by normalized name
  const groups = new Map<string, string[]>();

  for (const file of allTests) {
    const basename = path.basename(file, '.test.ts');
    const normalized = basename.toLowerCase().replace(/-/g, '');

    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized).push(file);
  }

  // Find groups with >1 file
  const duplicatePairs: DuplicateTestPair[] = [];

  for (const [_, files] of groups) {
    if (files.length === 2) {
      const kebab = files.find(f => f.includes('-'));
      const camel = files.find(f => !f.includes('-'));

      if (kebab && camel) {
        duplicatePairs.push({
          kebabCasePath: kebab,
          camelCasePath: camel,
          areIdentical: false,
          diffSummary: '',
          uniqueTestsInCamelCase: [],
          mergeRequired: false,
          migrated: false,
          deletedAt: null
        });
      }
    }
  }

  return duplicatePairs;
}
```

#### 4.2 Compare and Merge Duplicates

```typescript
for (const pair of duplicatePairs) {
  // Read both files
  const kebabContent = await fs.readFile(pair.kebabCasePath, 'utf-8');
  const camelContent = await fs.readFile(pair.camelCasePath, 'utf-8');

  // Compare
  pair.areIdentical = kebabContent === camelContent;

  if (pair.areIdentical) {
    console.log(`Files are identical: ${path.basename(pair.camelCasePath)}`);
    pair.diffSummary = "Files are identical";
  } else {
    console.log(`Files differ: ${path.basename(pair.camelCasePath)}`);

    // Compute diff
    const diff = computeDiff(kebabContent, camelContent);
    pair.diffSummary = summarizeDiff(diff);

    // Extract unique tests (if any)
    const uniqueTests = extractUniqueTests(camelContent, kebabContent);
    pair.uniqueTestsInCamelCase = uniqueTests;
    pair.mergeRequired = uniqueTests.length > 0;

    if (pair.mergeRequired) {
      console.log(`  Merging ${uniqueTests.length} unique tests...`);
      // Append to kebab-case file
      const mergedContent = kebabContent + '\n\n' + uniqueTests.join('\n\n');
      await fs.writeFile(pair.kebabCasePath, mergedContent, 'utf-8');
    }
  }

  // Delete camelCase file
  await fs.unlink(pair.camelCasePath);
  pair.migrated = true;
  pair.deletedAt = new Date();

  console.log(`✓ Deleted: ${path.basename(pair.camelCasePath)}`);
}
```

### Phase 5: Verification

#### 5.1 Run Test Suite

```bash
bun test --reporter=verbose > test-output.txt 2>&1
```

#### 5.2 Parse Test Output

```typescript
const output = await fs.readFile('test-output.txt', 'utf-8');

const passedMatch = output.match(/(\d+) passed/);
const failedMatch = output.match(/(\d+) failed/);
const todoMatch = output.match(/(\d+) todo/);

const verification: VerifyTestsOutput = {
  allTestsPass: !failedMatch || parseInt(failedMatch[1]) === 0,
  passed: passedMatch ? parseInt(passedMatch[1]) : 0,
  failed: failedMatch ? parseInt(failedMatch[1]) : 0,
  todos: todoMatch ? parseInt(todoMatch[1]) : 0,
  duration: extractDuration(output),
  newErrors: extractErrors(output),
  output
};

console.log(`Tests passed: ${verification.passed}`);
console.log(`Tests failed: ${verification.failed}`);
console.log(`TODOs: ${verification.todos}`);
```

### Phase 6: Generate Reports

#### 6.1 Calculate Metrics

```typescript
const report: GenerationReport = {
  totalRoutes: apiRoutes.length,
  routesWithTests: routesWithTests.length,
  routesWithoutTests: routesWithoutTests.length,
  skeletonsGenerated: skeletonTests.length,
  duplicatePairsFound: duplicatePairs.length,
  duplicatesMerged: duplicatePairs.filter(d => d.migrated).length,
  duplicatesDeleted: duplicatePairs.filter(d => d.deletedAt).length,
  coverageBefore: (routesWithTests.length / apiRoutes.length) * 100,
  coverageAfter: ((routesWithTests.length + skeletonTests.length) / apiRoutes.length) * 100,
  filesCreated: skeletonTests.map(s => s.filePath),
  filesModified: duplicatePairs.filter(d => d.mergeRequired).map(d => d.kebabCasePath),
  filesDeleted: duplicatePairs.map(d => d.camelCasePath),
  allTestsPass: verification.allTestsPass,
  newErrors: verification.newErrors,
  generatedAt: new Date(),
  duration: endTime.getTime() - startTime.getTime(),
  branch: "003-skeleton-tests"
};
```

#### 6.2 Export Reports

```typescript
// JSON report
await fs.writeFile(
  "specs/003-/generation-report.json",
  JSON.stringify(report, null, 2)
);

// Markdown report
const markdown = `
# Skeleton Test Generation Report

**Branch**: ${report.branch}
**Generated**: ${report.generatedAt.toISOString()}
**Duration**: ${(report.duration / 1000).toFixed(1)}s

## Summary

- **Total API Routes**: ${report.totalRoutes}
- **Routes with Tests Before**: ${report.routesWithTests} (${report.coverageBefore.toFixed(1)}%)
- **Skeleton Tests Generated**: ${report.skeletonsGenerated}
- **Routes with Tests After**: ${report.routesWithTests + report.skeletonsGenerated} (${report.coverageAfter.toFixed(1)}%)

## Duplicate Migration

- **Duplicate Pairs Found**: ${report.duplicatePairsFound}
- **Pairs Merged**: ${report.duplicatesMerged}
- **Files Deleted**: ${report.duplicatesDeleted}

## Verification

- **All Tests Pass**: ${report.allTestsPass ? '✓' : '✗'}
- **Tests Passed**: ${verification.passed}
- **Tests Failed**: ${verification.failed}
- **TODO Markers**: ${verification.todos}

## Files Created (${report.filesCreated.length})

${report.filesCreated.map(f => `- ${f}`).join('\n')}

## Files Deleted (${report.filesDeleted.length})

${report.filesDeleted.map(f => `- ${f}`).join('\n')}
`;

await fs.writeFile("specs/003-/generation-report.md", markdown);
```

## Common Issues

### Issue: "Schema not found"

**Cause**: Zod schema doesn't exist for this route.

**Solution**: Generate test with `TODO` comment about missing schema:

```typescript
// TODO: Create schema in ~/lib/schemas.ts
// import { createCategorySchema } from "~/lib/schemas";
```

### Issue: "Type not found"

**Cause**: Entity type not exported from `~/db/schema`.

**Solution**: Use generic type as fallback:

```typescript
import type { Category } from "~/db/schema"; // If available
// Otherwise use: Record<string, unknown>
```

### Issue: "Test file already exists"

**Cause**: Route already has a test (manual or previous generation).

**Solution**: Skip generation:

```typescript
if (route.hasTest) {
  console.log(`Skipping ${route.id}: test already exists`);
  continue;
}
```

### Issue: "Duplicate files have different content"

**Cause**: camelCase and kebab-case files diverged.

**Solution**: Review diff manually:

```bash
diff src/tests/api/media/add-media.test.ts src/tests/api/media/addMedia.test.ts
```

Then merge unique tests before deleting.

## Success Criteria Checklist

After completing the quickstart, verify:

- [ ] **SC-001**: 100% of API routes have corresponding test files
- [ ] **SC-002**: All skeleton tests pass with `bun test`
- [ ] **SC-003**: All test file names use kebab-case convention
- [ ] **SC-004**: Each skeleton test has at least 3 test cases per method
- [ ] **SC-005**: Running `bun test --reporter=verbose` shows clear TODO markers
- [ ] **SC-006**: All duplicate files are documented in migration report
- [ ] **SC-007**: Test organization follows `src/tests/{type}/{feature}/{endpoint}.test.ts`

## Next Steps

After generating skeleton tests:

1. **Review Generated Tests**: Manually review each skeleton test for accuracy
2. **Fill in TODOs**: Implement actual test logic as features are developed
3. **Add Integration Tests**: Create integration tests for complex workflows
4. **Update Schemas**: Create missing Zod schemas for validation
5. **CI Integration**: Add test coverage checks to CI pipeline

## Getting Help

- **Spec reference**: See `spec.md` for requirements
- **Data model**: See `data-model.md` for type definitions
- **Contracts**: See `contracts/test-generator.md` for tool details
- **Research**: See `research.md` for codebase analysis

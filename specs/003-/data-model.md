# Data Model: Skeleton Test Implementation

**Feature**: 003-skeleton-tests
**Date**: 2025-10-11
**Phase**: 1 (Design)

## Overview

This document defines the in-memory data structures used during skeleton test generation. No persistent storage is required - all data exists only during the generation process.

## Core Entities

### 1. APIRoute

Represents an API endpoint that needs skeleton tests.

```typescript
interface APIRoute {
  // Identification
  id: string;                    // Unique ID: relative path without extension
  filePath: string;              // Absolute path: /home/.../src/routes/api/categories/index.ts
  relativePath: string;          // Relative path: src/routes/api/categories/index.ts

  // Route information
  httpMethods: HTTPMethod[];     // ["GET", "POST"]
  routePattern: string;          // "/api/categories"
  parameters: RouteParameter[];  // [{ name: "id", type: "path", required: true }]

  // Code analysis
  hasImplementation: boolean;    // true if functions are implemented, false if stubs
  usesAuthentication: boolean;   // true if uses auth middleware
  importedSchemas: string[];     // ["createCategorySchema", "updateCategorySchema"]
  importedTypes: string[];       // ["Category"]

  // Test status
  hasTest: boolean;              // false if no test file exists
  testFilePath: string | null;   // "/home/.../src/tests/api/categories/index.test.ts"

  // Metadata
  complexity: "simple" | "medium" | "complex";  // Based on method count and logic
  priority: 1 | 2 | 3;          // From research.md prioritization
}
```

**Example**:
```typescript
{
  id: "categories/index",
  filePath: "/home/hmjn/project/web/solid-imager/src/routes/api/categories/index.ts",
  relativePath: "src/routes/api/categories/index.ts",
  httpMethods: ["GET", "POST"],
  routePattern: "/api/categories",
  parameters: [],
  hasImplementation: true,
  usesAuthentication: false,
  importedSchemas: ["createCategorySchema"],
  importedTypes: ["Category"],
  hasTest: false,
  testFilePath: null,
  complexity: "simple",
  priority: 1
}
```

### 2. RouteParameter

Represents a parameter in an API route (path, query, or body).

```typescript
interface RouteParameter {
  name: string;                  // "sourceId", "mediaId", "id"
  type: "path" | "query" | "body";
  paramType: string;             // "string", "number", "boolean", "unknown"
  required: boolean;             // true for path params, varies for query/body
  description?: string;          // Extracted from JSDoc if available

  // For dynamic routes
  isDynamic: boolean;            // true for [id], [sourceId], etc.
  isRest: boolean;               // true for [...directories]
}
```

**Example**:
```typescript
{
  name: "sourceId",
  type: "path",
  paramType: "string",
  required: true,
  isDynamic: true,
  isRest: false
}
```

### 3. HTTPMethod

Enum representing HTTP methods.

```typescript
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
```

### 4. SkeletonTest

Represents a generated skeleton test file.

```typescript
interface SkeletonTest {
  // File information
  filePath: string;              // Absolute path where test will be created
  relativePath: string;          // Relative path: src/tests/api/categories/index.test.ts

  // Source route
  apiRouteId: string;            // Reference to APIRoute.id
  apiRoutePath: string;          // "/api/categories"

  // Test structure
  describeBlocks: TestDescribeBlock[];  // One per HTTP method
  imports: TestImport[];         // Import statements needed

  // Code generation
  template: string;              // Full test file content
  generatedAt: Date;             // Timestamp of generation

  // Metadata
  testCount: number;             // Total number of it() blocks
  todoCount: number;             // Number of TODO comments
  hasSchemaValidation: boolean;  // true if includes Zod schema tests
  hasAuthentication: boolean;    // true if includes auth tests
}
```

**Example**:
```typescript
{
  filePath: "/home/hmjn/project/web/solid-imager/src/tests/api/categories/index.test.ts",
  relativePath: "src/tests/api/categories/index.test.ts",
  apiRouteId: "categories/index",
  apiRoutePath: "/api/categories",
  describeBlocks: [
    {
      httpMethod: "GET",
      description: "GET /api/categories",
      testCases: [...]
    },
    {
      httpMethod: "POST",
      description: "POST /api/categories",
      testCases: [...]
    }
  ],
  imports: [
    { source: "vitest", members: ["describe", "expect", "it"] },
    { source: "zod", members: ["ZodError"] },
    { source: "~/db/schema", members: ["Category"], isType: true }
  ],
  template: "// Generated test code...",
  generatedAt: new Date("2025-10-11"),
  testCount: 6,
  todoCount: 3,
  hasSchemaValidation: true,
  hasAuthentication: false
}
```

### 5. TestDescribeBlock

Represents a `describe()` block in a test file.

```typescript
interface TestDescribeBlock {
  httpMethod: HTTPMethod;        // "GET", "POST", etc.
  description: string;           // "GET /api/categories"
  testCases: TestCase[];         // Array of it() blocks
}
```

### 6. TestCase

Represents an individual `it()` test case.

```typescript
interface TestCase {
  description: string;           // "should return array of categories"
  type: "happy" | "validation" | "edge" | "error";
  code: string;                  // Test implementation code
  hasTodo: boolean;              // true if marked with TODO comment
  dependencies: string[];        // ["createCategorySchema", "Category"]
}
```

**Example**:
```typescript
{
  description: "should return array of categories",
  type: "happy",
  code: `
    // TODO: Implement after getCategories is available
    const result = await getCategories();
    expect(result).toBeInstanceOf(Array);
    expect(result[0]).toHaveProperty('id');
  `,
  hasTodo: true,
  dependencies: ["getCategories", "Category"]
}
```

### 7. TestImport

Represents an import statement in a test file.

```typescript
interface TestImport {
  source: string;                // "vitest", "~/db/schema", "zod"
  members: string[];             // ["describe", "it", "expect"]
  isType: boolean;               // true for `import type { ... }`
  isDefault: boolean;            // true for default imports
}
```

### 8. TestCoverage

Represents the mapping between API routes and their test coverage.

```typescript
interface TestCoverage {
  // Route info
  apiRouteId: string;            // Reference to APIRoute.id
  routePattern: string;          // "/api/categories"

  // Coverage metrics
  hasTest: boolean;              // true if any test exists
  testTypes: TestType[];         // ["contract", "integration", "e2e"]
  testFilePaths: string[];       // Absolute paths to test files

  // HTTP method coverage
  httpMethodsCovered: HTTPMethod[];  // ["GET", "POST"]
  httpMethodsUncovered: HTTPMethod[]; // ["DELETE"]

  // Quality metrics
  coveragePercentage: number;    // 0-100, based on methods covered
  hasSkeletonTest: boolean;      // true if skeleton test generated
  hasFullTest: boolean;          // true if test has real implementations

  // Metadata
  lastUpdated: Date;
}
```

**Example**:
```typescript
{
  apiRouteId: "categories/index",
  routePattern: "/api/categories",
  hasTest: true,
  testTypes: ["contract"],
  testFilePaths: ["/home/.../src/tests/api/categories/index.test.ts"],
  httpMethodsCovered: ["GET", "POST"],
  httpMethodsUncovered: [],
  coveragePercentage: 100,
  hasSkeletonTest: true,
  hasFullTest: false,
  lastUpdated: new Date("2025-10-11")
}
```

### 9. TestType

Enum representing types of tests.

```typescript
type TestType = "contract" | "integration" | "unit" | "e2e";
```

### 10. DuplicateTestPair

Represents a pair of duplicate test files (camelCase vs kebab-case).

```typescript
interface DuplicateTestPair {
  // File paths
  kebabCasePath: string;         // "/home/.../add-media.test.ts" (keep)
  camelCasePath: string;         // "/home/.../addMedia.test.ts" (delete)

  // Content analysis
  areIdentical: boolean;         // true if file contents are identical
  diffSummary: string;           // Summary of differences if not identical

  // Migration info
  uniqueTestsInCamelCase: string[];  // Test descriptions only in camelCase file
  mergeRequired: boolean;        // true if uniqueTestsInCamelCase.length > 0

  // Status
  migrated: boolean;             // true after migration complete
  deletedAt: Date | null;        // Timestamp of camelCase file deletion
}
```

**Example**:
```typescript
{
  kebabCasePath: "/home/hmjn/project/web/solid-imager/src/tests/api/media/add-media.test.ts",
  camelCasePath: "/home/hmjn/project/web/solid-imager/src/tests/api/media/addMedia.test.ts",
  areIdentical: true,
  diffSummary: "Files are identical",
  uniqueTestsInCamelCase: [],
  mergeRequired: false,
  migrated: false,
  deletedAt: null
}
```

### 11. GenerationReport

Represents the final report of skeleton test generation.

```typescript
interface GenerationReport {
  // Summary
  totalRoutes: number;           // 32
  routesWithTests: number;       // 19
  routesWithoutTests: number;    // 13
  skeletonsGenerated: number;    // 13

  // Duplicate handling
  duplicatePairsFound: number;   // 11
  duplicatesMerged: number;      // 11
  duplicatesDeleted: number;     // 11

  // Coverage metrics
  coverageBefore: number;        // Percentage before generation
  coverageAfter: number;         // Percentage after generation

  // File operations
  filesCreated: string[];        // Absolute paths of new test files
  filesModified: string[];       // Absolute paths of modified files
  filesDeleted: string[];        // Absolute paths of deleted duplicate files

  // Verification
  allTestsPass: boolean;         // true if `bun test` succeeded
  newErrors: string[];           // Any errors introduced

  // Metadata
  generatedAt: Date;
  duration: number;              // Milliseconds
  branch: string;                // "003-skeleton-tests"
}
```

## Relationships

### Entity Relationship Diagram

```
APIRoute (1) -----> (0..1) SkeletonTest
    |                           |
    | (1)                       | (*)
    v                           v
RouteParameter            TestDescribeBlock
                                |
                                | (*)
                                v
                            TestCase

APIRoute (1) -----> (1) TestCoverage

DuplicateTestPair (2) -----> (2) [File Paths]

GenerationReport (1) -----> (*) SkeletonTest
GenerationReport (1) -----> (*) DuplicateTestPair
```

### Key Relationships

1. **APIRoute → SkeletonTest**: One-to-zero-or-one
   - Each API route may have one skeleton test generated
   - If route already has a test, no skeleton is created

2. **APIRoute → RouteParameter**: One-to-many
   - Each route has zero or more parameters

3. **SkeletonTest → TestDescribeBlock**: One-to-many
   - Each skeleton test has one describe block per HTTP method

4. **TestDescribeBlock → TestCase**: One-to-many
   - Each describe block has 3-5 test cases (happy, validation, edge cases)

5. **APIRoute → TestCoverage**: One-to-one
   - Each route has one coverage record

6. **GenerationReport → Everything**: One-to-many
   - Report aggregates all generated entities

## Data Flow

### Phase 1: Discovery

```
File System
    ↓
[Glob API routes] → APIRoute[]
    ↓
[Parse route files] → Update APIRoute with methods, schemas, types
    ↓
[Check for existing tests] → Update APIRoute.hasTest
    ↓
APIRoute[] (complete)
```

### Phase 2: Analysis

```
APIRoute[]
    ↓
[Filter untested routes] → APIRoute[] (hasTest === false)
    ↓
[Prioritize by complexity] → APIRoute[] (sorted by priority)
    ↓
[Identify duplicates] → DuplicateTestPair[]
```

### Phase 3: Generation

```
APIRoute
    ↓
[Generate describe blocks per method] → TestDescribeBlock[]
    ↓
[Generate test cases per block] → TestCase[]
    ↓
[Assemble imports] → TestImport[]
    ↓
[Render template] → SkeletonTest
    ↓
[Write to file system] → Test file created
    ↓
TestCoverage (updated)
```

### Phase 4: Duplicate Handling

```
DuplicateTestPair[]
    ↓
[Compare file contents] → Update areIdentical, diffSummary
    ↓
[Merge unique tests if needed] → Update kebab-case file
    ↓
[Delete camelCase file] → Update migrated, deletedAt
```

### Phase 5: Verification & Reporting

```
SkeletonTest[] + DuplicateTestPair[]
    ↓
[Run bun test] → Update allTestsPass, newErrors
    ↓
[Calculate coverage] → Update coverageBefore, coverageAfter
    ↓
[Aggregate metrics] → GenerationReport
    ↓
[Export to JSON/Markdown] → Report files
```

## Implementation Notes

### In-Memory Processing

All data structures exist only in memory during script execution. No database or persistent storage is needed.

**Typical flow**:
```typescript
// 1. Discover routes
const apiRoutes: APIRoute[] = await discoverAPIRoutes();

// 2. Generate skeletons
const skeletons: SkeletonTest[] = [];
for (const route of apiRoutes.filter(r => !r.hasTest)) {
  const skeleton = await generateSkeletonTest(route);
  skeletons.push(skeleton);
  await writeTestFile(skeleton);
}

// 3. Handle duplicates
const duplicates: DuplicateTestPair[] = await findDuplicates();
for (const pair of duplicates) {
  await mergeDuplicates(pair);
}

// 4. Generate report
const report: GenerationReport = createReport(skeletons, duplicates);
await writeReportFiles(report);
```

### Template System

Skeleton tests use string templates with placeholders:

```typescript
const SKELETON_TEST_TEMPLATE = `
import { describe, expect, it } from "vitest";
{{#if hasZodSchema}}
import { ZodError } from "zod";
import { {{schemaName}} } from "~/lib/schemas";
{{/if}}
{{#if hasType}}
import type { {{typeName}} } from "~/db/schema";
{{/if}}

{{#each describeBlocks}}
describe("{{description}}", () => {
  {{#each testCases}}
  it("{{description}}", () => {
    {{code}}
  });
  {{/each}}
});
{{/each}}
`;
```

### File Naming Convention

All generated files use **kebab-case**:
- ✓ `categories-index.test.ts` or `index.test.ts` (in `categories/` dir)
- ✓ `[id].test.ts` (preserves bracket notation)
- ❌ `categoriesIndex.test.ts`

### Error Handling

```typescript
interface GenerationError {
  type: "parse" | "template" | "file" | "validation";
  message: string;
  routeId: string;
  filePath: string;
  recoverable: boolean;
}
```

If errors occur:
1. **Log error** to `generation-errors.json`
2. **Skip route** and continue with next
3. **Report errors** in final GenerationReport
4. **Don't fail entire process** unless critical

## Validation Rules

### APIRoute Validation

- `httpMethods` must not be empty
- `routePattern` must start with `/api/`
- `filePath` must exist on file system
- If `hasTest === true`, `testFilePath` must be set

### SkeletonTest Validation

- `describeBlocks.length` must equal `apiRoute.httpMethods.length`
- Each `describeBlock` must have at least 3 test cases
- `todoCount` must be >= 1 (skeletons are incomplete by design)
- `testCount` must be >= 3 * `httpMethods.length`

### DuplicateTestPair Validation

- Both `kebabCasePath` and `camelCasePath` must exist before migration
- After migration, only `kebabCasePath` should exist
- `areIdentical` must be determined before `mergeRequired`

## Export Formats

### JSON Export

All entities can be serialized to JSON for debugging or external processing:

```json
{
  "apiRoutes": [...],
  "skeletonTests": [...],
  "testCoverage": [...],
  "duplicatePairs": [...],
  "generationReport": {...}
}
```

### Markdown Export

Human-readable reports (see quickstart.md for examples):
- `generation-report.md`: Summary with tables
- `duplicate-migration.md`: List of duplicate pairs and status
- `coverage-report.md`: Before/after coverage metrics

## References

- **Research findings**: See `research.md` for API route analysis
- **Test patterns**: See existing `src/tests/api/media/add-media.test.ts`
- **Zod schemas**: See `src/lib/schemas.ts` (if exists)
- **Entity types**: See `src/db/schema.ts`

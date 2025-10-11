# Contract: Skeleton Test Generator Interface

**Feature**: 003-skeleton-tests
**Version**: 1.0.0
**Date**: 2025-10-11

## Overview

This contract defines the interface for the skeleton test generation tool. The tool is implemented using Serena's semantic code analysis capabilities combined with file system operations.

## Tool Chain

### Primary Tools

1. **Serena MCP**: Semantic code analysis
   - `find_symbol`: Discover functions in route files
   - `get_symbols_overview`: Get file structure
   - `read_file`: Read route and test file contents
   - `list_dir`: Discover files

2. **File System**: Node.js/Bun fs operations
   - `fs.readFile`: Read files
   - `fs.writeFile`: Write generated tests
   - `fs.unlink`: Delete duplicate files
   - `glob`: Pattern matching for discovery

3. **Code Parsing**: TypeScript AST analysis (optional)
   - Parse HTTP method exports (GET, POST, PUT, DELETE)
   - Extract import statements
   - Identify Zod schemas

## Phase 1: API Route Discovery

### Input Contract

```typescript
interface DiscoverRoutesInput {
  baseDir: string;                // "/home/.../src/routes/api"
  recursive: boolean;             // true
  extensions: string[];           // [".ts"]
  exclude: string[];              // ["*.test.ts", "*.spec.ts"]
}
```

### Process

1. **Find all route files**:
   ```bash
   find ${baseDir} -type f -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts"
   ```

2. **For each route file**:
   - Read file content using Serena `read_file`
   - Parse exports to identify HTTP methods
   - Extract imports (schemas, types)
   - Determine route pattern from file path

3. **Build APIRoute objects** (see data-model.md)

### Output Contract

```typescript
interface DiscoverRoutesOutput {
  routes: APIRoute[];             // All discovered routes
  totalCount: number;             // Total route files found
  errors: DiscoveryError[];       // Any parsing errors
}

interface DiscoveryError {
  filePath: string;
  errorType: "parse" | "read" | "access";
  message: string;
}
```

### Example Usage

```typescript
const discovery = await discoverAPIRoutes({
  baseDir: "/home/hmjn/project/web/solid-imager/src/routes/api",
  recursive: true,
  extensions: [".ts"],
  exclude: ["*.test.ts", "*.spec.ts"]
});

console.log(`Found ${discovery.totalCount} route files`);
console.log(`Parsed ${discovery.routes.length} routes successfully`);
```

### Expected Performance

- **Speed**: <5 seconds for ~30 routes
- **Memory**: <100MB for route metadata
- **Reliability**: Must handle malformed files gracefully

## Phase 2: Test Existence Check

### Input Contract

```typescript
interface CheckTestExistenceInput {
  routes: APIRoute[];             // From Phase 1
  testBaseDir: string;            // "/home/.../src/tests"
  namingConvention: "kebab-case" | "camelCase" | "both";
}
```

### Process

1. **For each route**, generate expected test path:
   ```typescript
   // Route: src/routes/api/categories/index.ts
   // Expected test: src/tests/api/categories/index.test.ts

   const testPath = route.relativePath
     .replace("src/routes/", "src/tests/")
     .replace(".ts", ".test.ts");
   ```

2. **Check if test file exists**:
   ```typescript
   const exists = await fileExists(testPath);
   route.hasTest = exists;
   route.testFilePath = exists ? testPath : null;
   ```

3. **Also check for integration/e2e tests** (optional):
   ```typescript
   const integrationPath = testPath.replace("/api/", "/integration/");
   const e2ePath = testPath.replace("/api/", "/e2e/").replace(".test.ts", ".spec.ts");
   ```

### Output Contract

```typescript
interface CheckTestExistenceOutput {
  routesWithTests: APIRoute[];    // hasTest === true
  routesWithoutTests: APIRoute[]; // hasTest === false
  coveragePercentage: number;     // 0-100
}
```

### Example Usage

```typescript
const testCheck = await checkTestExistence({
  routes: discovery.routes,
  testBaseDir: "/home/hmjn/project/web/solid-imager/src/tests",
  namingConvention: "both"
});

console.log(`Coverage: ${testCheck.coveragePercentage}%`);
console.log(`Need to generate ${testCheck.routesWithoutTests.length} tests`);
```

## Phase 3: Skeleton Test Generation

### Input Contract

```typescript
interface GenerateSkeletonTestInput {
  route: APIRoute;                // Single route to generate test for
  templateDir: string;            // Path to test templates
  options: GenerationOptions;
}

interface GenerationOptions {
  includeSchemaValidation: boolean; // Default: true
  includeAuthTests: boolean;        // Default: false (add TODOs)
  includeEdgeCases: boolean;        // Default: true
  testCasesPerMethod: number;       // Default: 3 (happy, validation, edge)
  useMockData: boolean;             // Default: true
}
```

### Process

1. **Load template**:
   ```typescript
   const template = await loadTemplate("skeleton-test.hbs");
   ```

2. **Gather dependencies**:
   ```typescript
   // Check if Zod schema exists
   const schemaName = `${route.id}RequestSchema`;
   const schemaExists = await checkSchemaExists(schemaName);

   // Check if entity type exists
   const typeName = capitalize(route.id.split('/')[0]);
   const typeExists = await checkTypeExists(typeName);
   ```

3. **Generate describe blocks** (one per HTTP method):
   ```typescript
   for (const method of route.httpMethods) {
     const describeBlock = generateDescribeBlock(method, route);
     skeleton.describeBlocks.push(describeBlock);
   }
   ```

4. **Generate test cases** (per describe block):
   ```typescript
   const testCases: TestCase[] = [
     generateHappyPathTest(method, route),
     generateValidationTest(method, route),
     generateEdgeCaseTest(method, route)
   ];
   ```

5. **Render template**:
   ```typescript
   const code = template.render({
     route,
     describeBlocks,
     imports,
     hasSchema: schemaExists,
     hasType: typeExists
   });
   ```

### Output Contract

```typescript
interface GenerateSkeletonTestOutput {
  skeleton: SkeletonTest;         // Complete skeleton test object
  code: string;                   // Rendered TypeScript code
  warnings: string[];             // Missing schemas, types, etc.
}
```

### Test Case Templates

#### GET Method Template

```typescript
describe("GET ${routePattern}", () => {
  it("should return ${entityName}[] on success", async () => {
    // TODO: Implement after ${functionName} is available
    const result = await ${functionName}();

    expect(result).toBeInstanceOf(Array);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('id');
      // Add more assertions based on schema
    }
  });

  it("should return empty array when no ${entityName}s exist", async () => {
    // TODO: Setup empty database state
    const result = await ${functionName}();
    expect(result).toEqual([]);
  });

  it("should handle query parameters correctly", async () => {
    // TODO: Test filtering, pagination, sorting
    const result = await ${functionName}({ limit: 10, offset: 0 });
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
```

#### POST Method Template

```typescript
describe("POST ${routePattern}", () => {
  it("should create and return new ${entityName}", async () => {
    const newData = {
      // TODO: Fill with valid data matching schema
      name: "Test ${entityName}",
      // ... other required fields
    };

    ${#if hasSchema}
    // Validate with Zod schema
    ${schemaName}.parse(newData);
    ${/if}

    // TODO: Implement after ${functionName} is available
    // const result = await ${functionName}(newData);
    const result: ${typeName} = {
      id: "mock-uuid-123",
      ...newData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    expect(result).toBeDefined();
    expect(result.id).toBeTypeOf("string");
    expect(result.name).toBe(newData.name);
  });

  ${#if hasSchema}
  it("should throw ZodError for invalid data", () => {
    const invalidData = {
      // Missing required fields
    };

    expect(() => ${schemaName}.parse(invalidData)).toThrow(ZodError);
  });
  ${/if}

  it("should reject duplicate ${entityName}s", async () => {
    // TODO: Test unique constraint
    const data = { name: "Duplicate Name" };

    // First creation should succeed
    // await ${functionName}(data);

    // Second should fail
    // await expect(${functionName}(data)).rejects.toThrow('already exists');
  });
});
```

#### PUT Method Template

```typescript
describe("PUT ${routePattern}", () => {
  it("should update and return ${entityName}", async () => {
    const updateData = {
      // TODO: Fill with valid update data
      name: "Updated Name"
    };

    ${#if hasSchema}
    ${updateSchemaName}.parse(updateData);
    ${/if}

    // TODO: Implement after ${updateFunctionName} is available
    // const result = await ${updateFunctionName}(id, updateData);
    const result: ${typeName} = {
      id: "existing-id",
      ...updateData,
      updatedAt: new Date()
    };

    expect(result).toBeDefined();
    expect(result.name).toBe(updateData.name);
  });

  it("should throw error for non-existent ${entityName}", async () => {
    // TODO: Test not found scenario
    const fakeId = "non-existent-id";

    // await expect(${updateFunctionName}(fakeId, {})).rejects.toThrow('not found');
  });

  ${#if hasSchema}
  it("should throw ZodError for invalid update data", () => {
    const invalidData = { name: 123 }; // Wrong type

    expect(() => ${updateSchemaName}.parse(invalidData)).toThrow(ZodError);
  });
  ${/if}
});
```

#### DELETE Method Template

```typescript
describe("DELETE ${routePattern}", () => {
  it("should delete ${entityName} and return success", async () => {
    // TODO: Implement after ${deleteFunctionName} is available
    const id = "existing-id";

    // const result = await ${deleteFunctionName}(id);
    // expect(result.success).toBe(true);
  });

  it("should throw error for non-existent ${entityName}", async () => {
    // TODO: Test not found scenario
    const fakeId = "non-existent-id";

    // await expect(${deleteFunctionName}(fakeId)).rejects.toThrow('not found');
  });

  it("should handle cascading deletes correctly", async () => {
    // TODO: Test related data cleanup
    // If deleting a category, associated items should be handled
  });
});
```

### Example Usage

```typescript
const generation = await generateSkeletonTest({
  route: apiRoute,
  templateDir: "./.specify/templates/tests",
  options: {
    includeSchemaValidation: true,
    includeAuthTests: false,
    includeEdgeCases: true,
    testCasesPerMethod: 3,
    useMockData: true
  }
});

console.log(`Generated ${generation.skeleton.testCount} test cases`);
console.log(`Warnings: ${generation.warnings.join(", ")}`);
```

## Phase 4: File Writing

### Input Contract

```typescript
interface WriteTestFileInput {
  skeleton: SkeletonTest;         // From Phase 3
  overwrite: boolean;             // Default: false
  dryRun: boolean;                // Default: false (preview only)
}
```

### Process

1. **Ensure directory exists**:
   ```typescript
   const dir = path.dirname(skeleton.filePath);
   await fs.mkdir(dir, { recursive: true });
   ```

2. **Check for existing file**:
   ```typescript
   const exists = await fileExists(skeleton.filePath);
   if (exists && !overwrite) {
     throw new Error(`Test file already exists: ${skeleton.filePath}`);
   }
   ```

3. **Write file**:
   ```typescript
   if (!dryRun) {
     await fs.writeFile(skeleton.filePath, skeleton.template, 'utf-8');
   }
   ```

4. **Format with Biome**:
   ```bash
   bun run biome format --write ${skeleton.filePath}
   ```

### Output Contract

```typescript
interface WriteTestFileOutput {
  success: boolean;
  filePath: string;
  bytesWritten: number;
  formatted: boolean;             // true if Biome formatting succeeded
}
```

## Phase 5: Duplicate Detection & Migration

### Input Contract

```typescript
interface FindDuplicatesInput {
  testBaseDir: string;            // "/home/.../src/tests"
  patterns: string[];             // ["**/*.test.ts"]
}
```

### Process

1. **Find all test files**:
   ```bash
   find ${testBaseDir} -name "*.test.ts" -o -name "*.spec.ts"
   ```

2. **Group by normalized name**:
   ```typescript
   const groups = new Map<string, string[]>();
   for (const file of testFiles) {
     const normalized = normalizeFileName(file);
     if (!groups.has(normalized)) {
       groups.set(normalized, []);
     }
     groups.get(normalized).push(file);
   }
   ```

3. **Identify duplicates** (groups with >1 file):
   ```typescript
   const duplicates: DuplicateTestPair[] = [];
   for (const [normalized, files] of groups) {
     if (files.length > 1) {
       const kebab = files.find(f => f.includes('-'));
       const camel = files.find(f => !f.includes('-'));
       if (kebab && camel) {
         duplicates.push({ kebabCasePath: kebab, camelCasePath: camel });
       }
     }
   }
   ```

### Output Contract

```typescript
interface FindDuplicatesOutput {
  duplicatePairs: DuplicateTestPair[];
  totalDuplicates: number;
}
```

### Merge Duplicate Pair

#### Input Contract

```typescript
interface MergeDuplicateInput {
  pair: DuplicateTestPair;
  keepVersion: "kebab" | "camel";  // Default: "kebab"
  dryRun: boolean;                 // Default: false
}
```

#### Process

1. **Compare file contents**:
   ```typescript
   const kebabContent = await fs.readFile(pair.kebabCasePath, 'utf-8');
   const camelContent = await fs.readFile(pair.camelCasePath, 'utf-8');

   pair.areIdentical = kebabContent === camelContent;
   ```

2. **If not identical, diff and merge**:
   ```typescript
   if (!pair.areIdentical) {
     const diff = computeDiff(kebabContent, camelContent);
     const uniqueTests = extractUniqueTests(diff);
     pair.uniqueTestsInCamelCase = uniqueTests;
     pair.mergeRequired = uniqueTests.length > 0;

     if (pair.mergeRequired) {
       // Append unique tests to kebab-case file
       await appendTests(pair.kebabCasePath, uniqueTests);
     }
   }
   ```

3. **Delete camelCase version**:
   ```typescript
   if (!dryRun) {
     await fs.unlink(pair.camelCasePath);
     pair.migrated = true;
     pair.deletedAt = new Date();
   }
   ```

#### Output Contract

```typescript
interface MergeDuplicateOutput {
  pair: DuplicateTestPair;        // Updated with migration status
  testsAdded: number;             // Number of tests merged
  success: boolean;
}
```

## Phase 6: Verification

### Input Contract

```typescript
interface VerifyTestsInput {
  testCommand: string;            // "bun test"
  timeout: number;                // Milliseconds, default 60000
}
```

### Process

1. **Run test suite**:
   ```bash
   bun test 2>&1 | tee test-output.txt
   ```

2. **Parse output**:
   ```typescript
   const passed = /(\d+) passed/.exec(output)?.[1] || "0";
   const failed = /(\d+) failed/.exec(output)?.[1] || "0";
   const todos = /(\d+) todo/.exec(output)?.[1] || "0";
   ```

3. **Check for new errors**:
   ```typescript
   // Compare against baseline if available
   const newErrors = detectNewErrors(output, baseline);
   ```

### Output Contract

```typescript
interface VerifyTestsOutput {
  allTestsPass: boolean;
  passed: number;
  failed: number;
  todos: number;
  duration: number;               // Milliseconds
  newErrors: string[];
  output: string;                 // Full test output
}
```

### Example Usage

```typescript
const verification = await verifyTests({
  testCommand: "bun test",
  timeout: 60000
});

if (!verification.allTestsPass) {
  console.error(`${verification.failed} tests failed`);
  console.error(verification.newErrors.join("\n"));
}
```

## Phase 7: Report Generation

### Input Contract

```typescript
interface GenerateReportInput {
  discovery: DiscoverRoutesOutput;
  testCheck: CheckTestExistenceOutput;
  generated: SkeletonTest[];
  duplicates: DuplicateTestPair[];
  verification: VerifyTestsOutput;
  startTime: Date;
  endTime: Date;
}
```

### Process

1. **Calculate metrics**:
   ```typescript
   const report: GenerationReport = {
     totalRoutes: discovery.totalCount,
     routesWithTests: testCheck.routesWithTests.length,
     routesWithoutTests: testCheck.routesWithoutTests.length,
     skeletonsGenerated: generated.length,
     duplicatePairsFound: duplicates.length,
     duplicatesMerged: duplicates.filter(d => d.migrated).length,
     duplicatesDeleted: duplicates.filter(d => d.deletedAt).length,
     coverageBefore: testCheck.coveragePercentage,
     coverageAfter: calculateNewCoverage(),
     // ... more metrics
   };
   ```

2. **Export to JSON**:
   ```typescript
   await fs.writeFile(
     "specs/003-/generation-report.json",
     JSON.stringify(report, null, 2)
   );
   ```

3. **Export to Markdown**:
   ```typescript
   const markdown = renderReportTemplate(report);
   await fs.writeFile("specs/003-/generation-report.md", markdown);
   ```

### Output Contract

```typescript
interface GenerateReportOutput {
  report: GenerationReport;
  jsonPath: string;
  markdownPath: string;
}
```

## Error Handling

### Error Types

```typescript
type ErrorType =
  | "file_not_found"
  | "parse_error"
  | "template_error"
  | "write_error"
  | "schema_missing"
  | "type_missing"
  | "test_failure"
  | "verification_error";
```

### Error Response

All phases return errors in consistent format:

```typescript
interface ToolError {
  type: ErrorType;
  phase: "discovery" | "generation" | "migration" | "verification";
  message: string;
  filePath?: string;
  routeId?: string;
  recoverable: boolean;
  suggestion?: string;
}
```

### Handling Strategy

1. **Recoverable errors**: Log and continue
2. **Non-recoverable errors**: Stop phase, report, ask user
3. **Verification errors**: Always report, don't auto-fix

## Performance Constraints

- **Discovery**: <5 seconds for 32 routes
- **Generation**: <2 seconds per skeleton test
- **Migration**: <1 second per duplicate pair
- **Verification**: <60 seconds for full test suite
- **Total**: <5 minutes for complete workflow

## Quality Gates

### Pre-Generation Gates

- ✅ All API routes successfully parsed
- ✅ Test directories exist and are writable
- ✅ Template files are valid

### Post-Generation Gates

- ✅ All skeleton tests have valid TypeScript syntax
- ✅ `bun test` runs without syntax errors
- ✅ All TODOs are properly marked
- ✅ Coverage increased by expected amount

### Pre-Migration Gates

- ✅ All duplicate pairs identified
- ✅ Backup created (optional)
- ✅ User confirmation (if interactive)

### Post-Migration Gates

- ✅ All camelCase files deleted
- ✅ All kebab-case files retained
- ✅ No test functionality lost
- ✅ `bun test` still passes

## References

- **Data structures**: See `data-model.md`
- **Test patterns**: See `research.md`
- **Serena tools**: See `contracts/serena-analysis.md` from feature 002

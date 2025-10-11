# Contract: Serena Analysis Interface

**Feature**: Function Argument Correction
**Version**: 1.0.0

## Overview

This contract defines the interface between the correction workflow and Serena's symbolic code analysis tools. It specifies the input/output formats and usage patterns for Serena tools.

## Tool: `find_symbol`

### Purpose
Locate function and method declarations in the codebase.

### Input Contract

```typescript
interface FindSymbolInput {
  name_path: string;              // Symbol name or path pattern
  relative_path?: string;         // Restrict to file/directory
  substring_matching?: boolean;   // Enable fuzzy matching
  include_body?: boolean;         // Include function body
  depth?: number;                 // Include children (0 = no children)
  include_kinds?: number[];       // LSP symbol kinds to include
  exclude_kinds?: number[];       // LSP symbol kinds to exclude
}
```

### Output Contract

```typescript
interface FindSymbolOutput {
  symbols: SymbolInfo[];
}

interface SymbolInfo {
  name_path: string;              // Full symbol path
  kind: number;                   // LSP SymbolKind (12=Function, 6=Method)
  relative_path: string;          // File path relative to project root
  body_location: {
    start_line: number;
    end_line: number;
  };
  body?: string;                  // Present if include_body=true
}
```

### Usage Pattern

**Find all functions in a directory:**
```typescript
const result = await mcp__serena__find_symbol({
  name_path: "/",                 // Match all top-level symbols
  relative_path: "src/lib/api",
  include_kinds: [12],            // Functions only
  include_body: false,            // No body needed for discovery
  depth: 0
});
```

**Get specific function with body:**
```typescript
const result = await mcp__serena__find_symbol({
  name_path: "createMediaSource",
  include_body: true,
  substring_matching: false
});
```

## Tool: `find_referencing_symbols`

### Purpose
Locate all call sites for a given function.

### Input Contract

```typescript
interface FindReferencingSymbolsInput {
  name_path: string;              // Symbol to find references for
  relative_path: string;          // File containing the symbol (required)
  include_kinds?: number[];       // Filter referencing symbols
  exclude_kinds?: number[];       // Exclude referencing symbols
}
```

### Output Contract

```typescript
interface FindReferencingSymbolsOutput {
  references: ReferenceInfo[];
}

interface ReferenceInfo {
  name_path: string;              // Referencing symbol's path
  kind: number;                   // Referencing symbol's kind
  relative_path: string;          // File containing reference
  snippet: string;                // Code snippet around reference
  // Location information embedded in snippet
}
```

### Usage Pattern

**Find all calls to a function:**
```typescript
const result = await mcp__serena__find_referencing_symbols({
  name_path: "createMediaSource",
  relative_path: "src/db/index.ts"
});
```

## Tool: `replace_regex`

### Purpose
Replace code using regular expression matching.

### Input Contract

```typescript
interface ReplaceRegexInput {
  relative_path: string;          // File to modify
  regex: string;                  // Python-style regex (DOTALL mode)
  repl: string;                   // Replacement with \1, \2 backreferences
  allow_multiple_occurrences?: boolean; // Allow multi-match (default: false)
}
```

### Output Contract

```typescript
interface ReplaceRegexOutput {
  success: boolean;
  error?: string;                 // Present if failed
  message?: string;               // Success message
}
```

### Usage Pattern

**Fix single argument order:**
```typescript
await mcp__serena__replace_regex({
  relative_path: "src/routes/api/sources/[sourceId]/index.ts",
  regex: "updateMediaSource\\((\\w+),\\s*(\\{[^}]+\\})\\)",
  repl: "updateMediaSource(\\2, \\1)",  // Swap arguments
  allow_multiple_occurrences: false
});
```

**Fix with context matching:**
```typescript
await mcp__serena__replace_regex({
  relative_path: "src/lib/api/media.ts",
  regex: "(const result =.*?)insertMedia\\(([^)]+), ([^)]+)\\)",
  repl: "\\1insertMedia(\\3)",  // Remove second argument
  allow_multiple_occurrences: false
});
```

## Tool: `read_file`

### Purpose
Read source file content for analysis.

### Input Contract

```typescript
interface ReadFileInput {
  relative_path: string;
  start_line?: number;            // Optional line range
  limit?: number;
}
```

### Output Contract

```typescript
interface ReadFileOutput {
  content: string;                // File content with line numbers
}
```

### Usage Pattern

**Read entire file:**
```typescript
const result = await mcp__serena__read_file({
  relative_path: "src/lib/api/sources.ts"
});
```

## Serena Workflow Contract

### Phase 1: Function Discovery

**Input**: None (scans entire src/ directory)

**Process**:
1. Call `find_symbol` with `include_kinds: [12, 6]` (Functions + Methods)
2. Filter to project files only (exclude node_modules, tests)
3. Build `FunctionSignature` collection

**Output**: `FunctionSignature[]`

**Performance**: ~100-500 functions expected, ~5-10 seconds

### Phase 2: Call Site Discovery

**Input**: `FunctionSignature[]`

**Process**:
For each function:
1. Call `find_referencing_symbols` with function's `name_path` and `relative_path`
2. Parse snippets to extract argument expressions
3. Build `CallSite` collection

**Output**: `CallSite[]`

**Performance**: ~10-50 calls per function, ~30-60 seconds total

### Phase 3: Mismatch Detection

**Input**: `FunctionSignature[]`, `CallSite[]`

**Process**:
For each call site:
1. Match call site to function signature
2. Compare argument count and types
3. Generate `ArgumentMismatch` if discrepancy found
4. Classify severity and fixability

**Output**: `ArgumentMismatch[]`

**Performance**: In-memory analysis, <1 second

### Phase 4: Fix Application

**Input**: `ArgumentMismatch[]` (fixable only)

**Process**:
For each fixable mismatch:
1. Generate fix strategy with regex pattern
2. Call `replace_regex` with pattern
3. Handle success/failure
4. Record result

**Output**: `AppliedFix[]`, `ManualReviewItem[]`

**Performance**: ~1-2 seconds per file, 10-30 seconds total

### Phase 5: Verification

**Input**: `AppliedFix[]`

**Process**:
1. Run `npx tsc --noEmit` to check types
2. Run `bun run check` to check linting
3. Parse output for new errors
4. Rollback if errors introduced

**Output**: `VerificationResult`

**Performance**: ~5-10 seconds

## Error Handling

### Serena Tool Errors

All Serena tools may return errors. Handle gracefully:

```typescript
try {
  const result = await mcp__serena__find_symbol({...});
  // Process result
} catch (error) {
  console.error('Serena error:', error.message);
  // Log to manual review
  // Continue with next item
}
```

### Regex Replacement Errors

`replace_regex` fails if:
- Pattern matches 0 times (no match)
- Pattern matches >1 times (ambiguous, unless `allow_multiple_occurrences: true`)
- File is read-only
- Syntax error in regex

Handle by flagging for manual review.

### Type Check Errors

After fixes, TypeScript may report new errors:
- Rollback last fix
- Flag as manual review
- Continue with remaining fixes

## Performance Constraints

- **Batch size**: Process max 10 files in parallel
- **Timeout**: 60 seconds per Serena tool call
- **Retry**: No retries (fail fast for manual review)
- **Memory**: Keep max 1000 items in memory at once

## Quality Constraints

- **Confidence threshold**: Only apply fixes with ≥80% confidence
- **Context required**: Always include 2-3 lines of context in regex
- **Validation**: TypeScript must compile after each file
- **Atomicity**: One file at a time, commit on success

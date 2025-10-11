# Data Model: Function Argument Correction

**Feature**: Function Argument Correction Using Serena
**Date**: 2025-10-11

## Overview

This document defines the data structures used during the function argument correction process. This is not a traditional database schema but rather the in-memory data model for tracking, analyzing, and reporting function signature mismatches.

## Core Entities

### FunctionSignature

Represents a function or method declaration with its complete parameter information.

```typescript
interface FunctionSignature {
  // Identity
  id: string;                    // Unique identifier (file path + symbol name path)
  name: string;                  // Function name (e.g., "createMediaSource")
  namePath: string;              // Full symbol path (e.g., "/createMediaSource" or "MediaService/updateMedia")
  kind: SymbolKind;              // 12 = Function, 6 = Method

  // Location
  filePath: string;              // Absolute path to file
  startLine: number;             // Start line of function declaration
  endLine: number;               // End line of function declaration

  // Parameters
  parameters: FunctionParameter[];
  returnType?: string;           // TypeScript return type (if available)

  // Metadata
  isAsync: boolean;
  isExported: boolean;
  visibility?: 'public' | 'private' | 'protected';
}
```

### FunctionParameter

Represents a single parameter in a function signature.

```typescript
interface FunctionParameter {
  name: string;                  // Parameter name
  type: string;                  // TypeScript type
  isOptional: boolean;           // Has ? marker
  hasDefault: boolean;           // Has default value
  defaultValue?: string;         // Default value literal
  isRest: boolean;               // Is ...rest parameter
  isDestructured: boolean;       // Is { a, b } pattern
  position: number;              // 0-indexed position
}
```

### CallSite

Represents a location where a function is invoked.

```typescript
interface CallSite {
  // Identity
  id: string;                    // Unique identifier
  functionId: string;            // References FunctionSignature.id

  // Location
  filePath: string;              // Absolute path to file
  line: number;                  // Line number of call
  column: number;                // Column number of call

  // Context
  codeSnippet: string;           // Source code around the call
  callingFunction?: string;      // Name of function making the call

  // Arguments
  arguments: CallArgument[];
}
```

### CallArgument

Represents a single argument passed to a function call.

```typescript
interface CallArgument {
  position: number;              // 0-indexed position
  expression: string;            // Source code of argument
  inferredType?: string;         // Best-guess type from context
  isSpread: boolean;             // Is ...spread argument
  isLiteral: boolean;            // Is literal value
}
```

### ArgumentMismatch

Represents a discrepancy between function signature and call site.

```typescript
interface ArgumentMismatch {
  // Identity
  id: string;
  functionId: string;            // References FunctionSignature.id
  callSiteId: string;            // References CallSite.id

  // Classification
  severity: 'error' | 'warning' | 'info';
  type: MismatchType;

  // Details
  description: string;
  expectedSignature: string;     // Human-readable expected signature
  actualCall: string;            // Human-readable actual call

  // Fix strategy
  fixable: boolean;
  fixStrategy?: FixStrategy;
  fixConfidence: number;         // 0-100

  // Metadata
  detectedAt: Date;
}
```

### MismatchType

Enumeration of mismatch categories.

```typescript
enum MismatchType {
  WRONG_COUNT = 'wrong_count',           // Too many or too few arguments
  WRONG_ORDER = 'wrong_order',           // Arguments in wrong order
  WRONG_TYPE = 'wrong_type',             // Type mismatch
  MISSING_REQUIRED = 'missing_required', // Missing required parameter
  EXTRA_ARGUMENT = 'extra_argument',     // Unexpected argument
  OPTIONAL_MISUSE = 'optional_misuse',   // Explicit undefined for optional param
}
```

### FixStrategy

Defines how to fix a mismatch.

```typescript
interface FixStrategy {
  type: FixType;
  description: string;
  before: string;                // Original code
  after: string;                 // Fixed code
  regex?: string;                // Regex pattern for replacement
  replacement?: string;          // Replacement string
}
```

### FixType

Enumeration of fix operations.

```typescript
enum FixType {
  REORDER = 'reorder',               // Change argument order
  ADD = 'add',                       // Add missing argument
  REMOVE = 'remove',                 // Remove extra argument
  WRAP = 'wrap',                     // Wrap value in type constructor
  SIMPLIFY = 'simplify',             // Remove unnecessary explicit undefined
  MANUAL = 'manual',                 // Requires human intervention
}
```

### FixReport

Aggregate report of all changes made.

```typescript
interface FixReport {
  // Summary
  totalFunctionsAnalyzed: number;
  totalCallSitesFound: number;
  totalMismatchesFound: number;
  totalFixesApplied: number;
  totalManualReviewNeeded: number;

  // Breakdown
  byFile: Record<string, FileFixSummary>;
  byFunction: Record<string, FunctionFixSummary>;
  bySeverity: Record<'error' | 'warning' | 'info', number>;
  byType: Record<MismatchType, number>;

  // Details
  appliedFixes: AppliedFix[];
  manualReviewItems: ManualReviewItem[];

  // Metadata
  executionTime: number;         // Milliseconds
  timestamp: Date;
}
```

### FileFixSummary

Summary of fixes for a single file.

```typescript
interface FileFixSummary {
  filePath: string;
  mismatchesFound: number;
  fixesApplied: number;
  manualReviewNeeded: number;
  status: 'clean' | 'fixed' | 'needs_review' | 'error';
}
```

### FunctionFixSummary

Summary of fixes for a single function.

```typescript
interface FunctionFixSummary {
  functionId: string;
  functionName: string;
  callSitesAnalyzed: number;
  mismatchesFound: number;
  fixesApplied: number;
  manualReviewNeeded: number;
}
```

### AppliedFix

Record of a successfully applied fix.

```typescript
interface AppliedFix {
  mismatchId: string;
  filePath: string;
  line: number;
  before: string;
  after: string;
  fixType: FixType;
  appliedAt: Date;
}
```

### ManualReviewItem

Item requiring human review.

```typescript
interface ManualReviewItem {
  mismatchId: string;
  severity: 'error' | 'warning' | 'info';
  filePath: string;
  line: number;
  reason: string;
  codeSnippet: string;
  suggestion?: string;
}
```

## Relationships

```
FunctionSignature (1) ─── (N) CallSite
                │
                │
                └── (N) ArgumentMismatch ─── (1) CallSite
                                │
                                └── (0..1) FixStrategy
                                            │
                                            └── (0..1) AppliedFix
```

## Data Flow

1. **Discovery Phase**:
   - Use Serena `find_symbol` to build `FunctionSignature` collection
   - For each signature, use `find_referencing_symbols` to build `CallSite` collection

2. **Analysis Phase**:
   - Compare each `CallSite` against its `FunctionSignature`
   - Generate `ArgumentMismatch` for discrepancies
   - Classify severity and fixability

3. **Fix Planning Phase**:
   - For fixable mismatches, generate `FixStrategy`
   - Calculate confidence score
   - Sort by confidence (high confidence first)

4. **Fix Application Phase**:
   - Apply fixes using Serena `replace_regex`
   - Record `AppliedFix` for each successful fix
   - Flag failures as `ManualReviewItem`

5. **Reporting Phase**:
   - Aggregate all fixes into `FixReport`
   - Generate human-readable markdown report
   - Output JSON for programmatic consumption

## Validation Rules

### Function Signature Validation

- All parameters must have valid TypeScript types
- Optional parameters must come after required ones (TypeScript rule)
- Rest parameters must be last
- No duplicate parameter names

### Call Site Validation

- Argument count must match parameter count (accounting for optional/rest)
- Argument types must be compatible with parameter types
- Required parameters must have corresponding arguments
- No extra arguments beyond parameters (unless rest parameter)

### Fix Strategy Validation

- Regex pattern must match exactly once in target code
- Replacement must preserve indentation
- Fixed code must be valid TypeScript syntax
- Fixed code must maintain semantic equivalence

## Performance Considerations

- **Batch processing**: Process functions in parallel where possible
- **Caching**: Cache parsed TypeScript AST for files
- **Incremental**: Skip already-fixed call sites
- **Early exit**: Stop on first unfixable error if requested

## Storage

All data models are in-memory only. Persistence:

- **FixReport** → Markdown + JSON files in `specs/002-serena/`
- **ManualReviewItem** → CSV for easy review in spreadsheet
- **No database required** - this is a one-time migration tool

# Feature Specification: Function Argument Correction Using Serena

**Feature Branch**: `002-serena`
**Created**: 2025-10-11
**Status**: Draft
**Input**: User description: "現在プロジェクト内には多数の関数があるが引数が間違っているものが多い、もとの宣言を確認して修復したい serenaを使用すること"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identify and Fix Type-Safe Function Calls (Priority: P1)

As a developer, I need the codebase to have correct function arguments matching their declarations so that TypeScript type checking passes and the code runs without runtime errors.

**Why this priority**: This is the most critical issue as incorrect function arguments cause immediate type errors, build failures, and potential runtime crashes. It blocks development and deployment.

**Independent Test**: Can be fully tested by running `npm run check` or `bun run check` to verify TypeScript compilation succeeds without argument-related errors, and delivers a type-safe, buildable codebase.

**Acceptance Scenarios**:

1. **Given** a function with incorrect number of arguments passed, **When** Serena analyzes and fixes the call sites, **Then** all function calls match their declarations with correct argument count
2. **Given** a function with arguments passed in wrong order, **When** Serena identifies the mismatch and corrects it, **Then** arguments are passed in the correct order matching the function signature
3. **Given** a function with arguments of wrong types, **When** Serena validates and fixes type mismatches, **Then** all arguments match the expected types in the function declaration

---

### User Story 2 - Handle Optional and Default Parameters Correctly (Priority: P2)

As a developer, I need function calls to properly handle optional parameters and default values so that the code is both correct and idiomatic.

**Why this priority**: While not as critical as missing/wrong arguments, incorrect handling of optional parameters leads to verbose code, potential bugs, and maintenance issues.

**Independent Test**: Can be tested by reviewing fixed functions to ensure optional parameters are used correctly and unnecessary arguments are removed, delivering cleaner, more maintainable code.

**Acceptance Scenarios**:

1. **Given** a function call passing undefined explicitly for optional parameters, **When** Serena identifies unnecessary explicit undefined, **Then** the call is simplified to omit optional arguments with default values
2. **Given** a function with required parameters followed by optional ones, **When** Serena validates the call pattern, **Then** required parameters are always provided and optional parameters are correctly handled

---

### User Story 3 - Document and Report Unfixable Issues (Priority: P3)

As a developer, I need a clear report of any function argument issues that cannot be automatically fixed so that I can manually review and address them.

**Why this priority**: Some complex cases may require human judgment, but documenting them is lower priority than fixing the majority of issues automatically.

**Independent Test**: Can be tested by reviewing the generated report of unfixable issues, ensuring it provides clear location and reason information for manual review.

**Acceptance Scenarios**:

1. **Given** a function call with ambiguous argument mapping, **When** Serena cannot confidently fix it, **Then** the issue is logged with file location and explanation
2. **Given** functions using complex spread operators or dynamic arguments, **When** Serena analyzes the code, **Then** potentially problematic patterns are flagged for manual review

---

### Edge Cases

- What happens when a function has overloaded signatures with different argument patterns?
- How does the system handle variadic functions (rest parameters)?
- What happens when function declarations are in external libraries or type declaration files?
- How are callback functions with varying signatures handled?
- What happens when arguments use complex destructuring patterns?
- How does the system handle functions called via `.call()`, `.apply()`, or `.bind()`?
- What happens when generic functions have type parameters that affect argument types?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST identify all function declarations in the codebase using Serena's `find_symbol` tool with appropriate filters for functions and methods
- **FR-002**: System MUST locate all call sites for each function using Serena's `find_referencing_symbols` tool
- **FR-003**: System MUST validate that each function call matches its declaration in terms of argument count, order, and types
- **FR-004**: System MUST automatically fix function calls where the correct mapping is unambiguous using Serena's `replace_regex` or `replace_symbol_body` tools
- **FR-005**: System MUST preserve code formatting and indentation when making fixes
- **FR-006**: System MUST handle both named functions and methods (class methods, object methods)
- **FR-007**: System MUST respect TypeScript type information when validating arguments
- **FR-008**: System MUST generate a report of all changes made and any issues requiring manual review
- **FR-009**: System MUST work incrementally, processing one file or function at a time to avoid overwhelming changes
- **FR-010**: System MUST verify fixes by running type checking after modifications
- **FR-011**: System MUST skip external library functions and focus on project-internal functions only
- **FR-012**: System MUST handle arrow functions, function expressions, and function declarations consistently

### Key Entities *(include if feature involves data)*

- **Function Declaration**: Represents a function or method definition with its parameter signature (names, types, optional markers, default values)
- **Function Call Site**: Represents a location where a function is invoked, including the arguments passed
- **Argument Mismatch**: Represents a discrepancy between a function declaration and its call site (wrong count, order, or type)
- **Fix Report**: A structured record of changes made, including file path, line number, original code, fixed code, and fix type

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: TypeScript compilation succeeds without argument-related type errors (target: zero function argument type errors)
- **SC-002**: All function calls in the codebase match their declarations in terms of argument count and order (measurable via static analysis)
- **SC-003**: Automated fixes are applied correctly without introducing new errors (verified by test suite passing before and after fixes)
- **SC-004**: Fix report provides clear documentation of all changes made, including file paths, line numbers, and change descriptions (100% of changes documented)
- **SC-005**: The codebase builds successfully with `bun run build` or `npm run build` after all fixes are applied

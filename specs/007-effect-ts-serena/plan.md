# Implementation Plan: Introduce Effect.ts to Backend

**Branch**: `007-effect-ts-serena` | **Date**: 2025-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-effect-ts-serena/spec.md`

## Summary

This plan outlines the refactoring of the backend services to use `Effect.ts`. The primary goal is to improve long-term stability, error handling, and maintainability by replacing Promise-based asynchronous operations with the Effect model. The initial scope is limited to `media-source-service.ts` and its corresponding API routes.

The technical approach involves using Effect's `Layer` for dependency injection of the database service, defining a generic `DbError` for typed errors, and executing Effect programs at the API boundary using `Effect.runPromise`.

## Technical Context

**Language/Version**: TypeScript (via Bun)
**Primary Dependencies**: SolidStart, Drizzle, Effect.ts
**Storage**: PostgreSQL
**Testing**: Playwright, Vitest
**Target Platform**: Node.js server
**Project Type**: Web Application
**Performance Goals**: Performance must be equal to or better than the previous Promise-based implementation.
**Constraints**: The refactoring must not change the public API contract and must be limited to the backend.
**Scale/Scope**: Initial refactoring is limited to one core service (`media-source-service`) to establish a pattern.

## Constitution Check

The project constitution is currently a template. This plan adheres to general best practices such as structured testing, clear contracts, and phased implementation.

## Project Structure

### Documentation (this feature)

```
specs/007-effect-ts-serena/
├── plan.md              # This file
├── spec.md              # The feature specification
├── research.md          # Technical approach for Effect.ts integration
├── data-model.md        # Data model for the new DbError type
├── quickstart.md        # Guide on how to use the new services
├── contracts/
│   └── media-source-service.md # Before/After signatures for the service
└── tasks.md             # Detailed implementation checklist
```

### Source Code (repository root)

The project follows a standard web application structure. This refactoring will primarily touch the following backend directories:

```
src/
├── application/services/  # Target for service-level refactoring
├── infrastructure/db/     # Location for new Effect layers, tags, and errors
└── routes/api/            # API boundary where Effects will be executed
```

**Structure Decision**: The existing project structure will be maintained. New files for Effect-ts integration (layers, tags, errors) will be co-located with the services they relate to, primarily within `src/infrastructure/db/`.

## Complexity Tracking

No constitutional violations identified that require justification.
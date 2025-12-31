# Plan: Alignment with Clean Architecture Principles

This plan outlines the steps to further decouple the Domain and Application layers from Infrastructure details, ensuring better testability and maintainability.

## 1. Objectives

- **Decoupling**: Application services should depend on interfaces, not implementations.
- **Pure Domain**: Infrastructure-specific APIs (Storage, DB, AI) should be hidden behind domain-defined interfaces.
- **Robust Error Handling**: Business logic should handle domain-specific errors, not database-specific exceptions.
- **Testability**: Simplify unit testing of services by enabling easy mocking of all external dependencies.

## 2. Targeted Improvements

### Task 1: Comprehensive Dependency Injection (DI)
**Problem**: Services currently instantiate repository implementations directly at the top level.
**Solution**: Refactor services to accept dependencies via parameters or a registry.

- [x] Refactor `MediaService` to accept `IMediaRepository`, `ISourceRepository`, and `IStorageService`.
- [x] Refactor `TaggingService` to accept `IPythonClient` (or an equivalent domain interface).
- [x] Implement a simple Service Locator or Dependency Container for the application layer.

### Task 2: Abstract Infrastructure Services
**Problem**: `MediaService` still imports `LocalMediaStorage` and Node.js built-ins.
**Solution**: Ensure all infrastructure tasks are defined as interfaces in the domain layer.

- [x] Define `IImageProcessor` in `src/domain/services` for tasks like metadata extraction and thumbnail generation.
- [x] Ensure `IStorageService` is the only point of contact for file operations in the application layer.
- [ ] Move any remaining Node.js specific code (e.g., `node:path`) into infrastructure implementations.

### Task 3: Domain Error Handling
**Problem**: Repository implementations throw infrastructure errors (`NotFoundError`, `ConstraintError`) from the DB layer.
**Solution**: Define business-level errors in the domain layer.

- [x] Create `src/domain/errors/index.ts` defining base domain errors (e.g., `DomainError`, `ResourceNotFound`, `ResourceConflict`).
- [x] Update all Repositories to catch database exceptions and re-throw appropriate Domain Errors.
- [x] Update API routes/middleware to handle Domain Errors and map them to HTTP status codes.

### Task 4: Strict Separation of Models
**Problem**: Some domain types might still be influenced by DB schema constraints or Drizzle-specific types.
**Solution**: Enforce strict mapping in repositories.

- [x] Audit all `mapToDomain` functions to ensure they return pure domain objects.
- [x] Verify that `src/domain` has zero imports from `src/infrastructure`.
- [x] Ensure API DTOs (Data Transfer Objects) are distinct from internal domain entities where necessary (especially for complex responses).
  - *Implemented `SafeMediaSource` to mask credentials in API responses.*

## 3. Implementation Checklist

### Phase 1: Error Handling & Registry
- [x] Define Domain Errors.
- [x] Implement a basic `ServiceRegistry` to hold implementation instances.
- [x] Update Repositories to throw Domain Errors.

### Phase 2: Service Refactoring
- [x] Refactor `MediaService` (highest priority).
- [x] Refactor `TaggingService` and `ThumbnailService`.
- [x] Remove direct infrastructure imports from `src/application/services` (mostly done).

### Phase 3: Validation
- [x] Verify unit tests can pass using mocks only (no DB, no FS).
  - *Added `src/tests/unit/application/services/media-service.test.ts` as proof.*
- [x] Run `bun run check` to ensure no illegal upward dependencies.


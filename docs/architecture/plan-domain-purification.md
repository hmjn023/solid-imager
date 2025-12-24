# Plan: Domain Layer Purification

This plan addresses Step 2 of "Phase 0" in the Client-Server Architecture Proposal: **Purify the Domain Layer**.

**Goal:** Remove environment-dependent APIs (Node.js/Bun/Drizzle) from `src/domain` and introduce the Repository pattern to decouple Application Services from Infrastructure details.

## Current State Analysis

*   **Domain Layer (`src/domain`)**: Mostly pure, containing Zod schemas and types. `utils` folders are currently placeholders.
*   **Infrastructure (`src/infrastructure/db/queries`)**: Contains direct Drizzle ORM queries.
*   **Application Services (`src/application/services`)**: Currently import `node:fs`, `node:path`, and direct DB queries (e.g., `media-sources.ts`), creating tight coupling.
*   **Repositories (`src/infrastructure/repositories`)**: `MediaRepository` class exists but is concrete and mixes generic logic with DB access.

## Implementation Steps

### Step 1: Define Repository Interfaces (`src/domain/repositories`)

Create interfaces that return Domain Entities (Zod inferred types), not Drizzle types.

1.  **`src/domain/repositories/media.repository.ts`**
    *   `findById(id: string): Promise<Media | null>`
    *   `findByPath(sourceId: string, filePath: string): Promise<Media | null>`
    *   `create(media: NewMedia): Promise<Media>`
    *   `update(id: string, media: Partial<Media>): Promise<Media>`
    *   `delete(id: string): Promise<void>`
    *   `search(criteria: MediaSearchCriteria): Promise<MediaSearchResponse>`

2.  **`src/domain/repositories/source.repository.ts`**
    *   `findAll(): Promise<MediaSource[]>`
    *   `findById(id: string): Promise<MediaSource | null>`
    *   `create(source: NewMediaSource): Promise<MediaSource>`
    *   `update(id: string, source: Partial<MediaSource>): Promise<MediaSource>`
    *   `delete(id: string): Promise<void>`

3.  **`src/domain/repositories/tag.repository.ts`**
    *   `findAll(): Promise<Tag[]>`
    *   `findById(id: number): Promise<Tag | null>`
    *   `findByName(name: string): Promise<Tag | null>`
    *   `create(tag: NewTag): Promise<Tag>`

### Step 2: Implement Repositories (`src/infrastructure/repositories`)

Implement the interfaces using Drizzle ORM. Move logic from `src/infrastructure/db/queries` into these classes.

1.  **Refactor `src/infrastructure/repositories/media-repository.ts`**
    *   Implement `IMediaRepository`.
    *   Move logic from `db/queries/media.ts`, `db/queries/media-random.ts`, etc.
2.  **Create `src/infrastructure/repositories/source-repository.ts`**
    *   Implement `ISourceRepository`.
    *   Move logic from `db/queries/media-sources.ts`.
3.  **Create `src/infrastructure/repositories/tag-repository.ts`**
    *   Implement `ITagRepository`.
    *   Move logic from `db/queries/tags.ts`.

### Step 3: Abstract File System Access

`MediaService` currently uses `node:fs` and `node:path`. This breaks the rule of "Pure Domain/Application Logic" if we want to reuse this in the browser (client app).

1.  **Define `IStorageDriver` or use existing `src/infrastructure/storage`**
    *   Ensure `MediaService` uses `getDriver(source.type)` to perform file operations instead of importing `fs` directly.
    *   If generic FS operations are needed (e.g. temp files), define a `IFileSystemAdapter`.

### Step 4: Refactor Application Services (`src/application/services`)

Update services to depend on Interfaces.

1.  **`MediaService`**:
    *   Inject `IMediaRepository` and `ISourceRepository` (or use a Service Locator/Container pattern if DI is too complex for now).
    *   Replace direct `import ... from "~/infrastructure/db/queries/..."` with repository calls.
2.  **`TagService`**:
    *   Inject `ITagRepository`.

### Step 5: Update Presentation Layer (`src/routes`)

*   Ensure API routes use the updated Application Services.
*   Verify that no direct DB queries are used in Routes (move them to Services/Repositories).

## Verification

*   Run `bun check` to ensure no circular dependencies or type errors.
*   Run existing tests to ensure no regression.
*   Verify that `src/domain` has **zero** imports from `src/infrastructure` (except maybe types if strictly necessary, but preferably not).

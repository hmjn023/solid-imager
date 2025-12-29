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

4.  **`src/domain/repositories/category.repository.ts`**
    *   `findAll(): Promise<Category[]>`
    *   `findById(id: string): Promise<Category | null>`
    *   `create(category: NewCategory): Promise<Category>`
    *   `update(id: string, category: Partial<Category>): Promise<Category>`
    *   `delete(id: string): Promise<void>`

5.  **`src/domain/repositories/character.repository.ts`**
    *   `findAll(): Promise<Character[]>`
    *   `findById(id: string): Promise<Character | null>`
    *   `create(character: NewCharacter): Promise<Character>`
    *   `update(id: string, character: Partial<Character>): Promise<Character>`
    *   `delete(id: string): Promise<void>`

6.  **`src/domain/repositories/ip.repository.ts`**
    *   `findAll(): Promise<Ip[]>`
    *   `findById(id: string): Promise<Ip | null>`
    *   `create(ip: NewIp): Promise<Ip>`
    *   `update(id: string, ip: Partial<Ip>): Promise<Ip>`
    *   `delete(id: string): Promise<void>`

7.  **`src/domain/repositories/project.repository.ts`**
    *   `findAll(): Promise<Project[]>`
    *   `findById(id: string): Promise<Project | null>`
    *   `create(project: NewProject): Promise<Project>`
    *   `update(id: string, project: Partial<Project>): Promise<Project>`
    *   `delete(id: string): Promise<void>`

8.  **`src/domain/repositories/collection.repository.ts`**
    *   `findAll(): Promise<Collection[]>`
    *   `findById(id: string): Promise<Collection | null>`
    *   `create(collection: NewCollection): Promise<Collection>`
    *   `update(id: string, collection: Partial<Collection>): Promise<Collection>`
    *   `delete(id: string): Promise<void>`
    *   `addItem(collectionId: string, item: NewCollectionItem): Promise<void>`
    *   `removeItem(collectionId: string, itemId: string): Promise<void>`

9.  **`src/domain/repositories/author.repository.ts`**
    *   `findAll(): Promise<Author[]>`
    *   `findById(id: string): Promise<Author | null>`
    *   `create(author: NewAuthor): Promise<Author>`
    *   `update(id: string, author: Partial<Author>): Promise<Author>`
    *   `delete(id: string): Promise<void>`

10. **`src/domain/repositories/job.repository.ts`** (Optional, depending on DB usage for jobs)
    *   `create(job: NewJob): Promise<Job>`
    *   `updateStatus(id: string, status: JobStatus, result?: any): Promise<void>`

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
4.  **Create `src/infrastructure/repositories/category-repository.ts`**
    *   Implement `ICategoryRepository`.
    *   Move logic from `db/queries/categories.ts`.
5.  **Create `src/infrastructure/repositories/character-repository.ts`**
    *   Implement `ICharacterRepository`.
    *   Move logic from `db/queries/characters.ts`.
6.  **Create `src/infrastructure/repositories/ip-repository.ts`**
    *   Implement `IIpRepository`.
    *   Move logic from `db/queries/ips.ts`.
7.  **Create `src/infrastructure/repositories/project-repository.ts`**
    *   Implement `IProjectRepository`.
    *   Move logic from `db/queries/projects.ts`.
8.  **Create `src/infrastructure/repositories/collection-repository.ts`**
    *   Implement `ICollectionRepository`.
    *   Move logic from `db/queries/collections.ts`.
9.  **Create `src/infrastructure/repositories/author-repository.ts`**
    *   Implement `IAuthorRepository`.
    *   Move logic from `db/queries/authors.ts`.

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
3.  **Other Services**:
    *   **`CategoryService`**: Inject `ICategoryRepository`.
    *   **`CharacterService`**: Inject `ICharacterRepository`.
    *   **`IpService`**: Inject `IIpRepository`.
    *   **`ProjectService`**: Inject `IProjectRepository`.
    *   **`CollectionService`**: Inject `ICollectionRepository`.
    *   **`UserSerivce`**: Inject `IUserRepository` (if defined).

### Step 5: Update Presentation Layer (`src/routes`)

*   Ensure API routes use the updated Application Services.
*   Verify that no direct DB queries are used in Routes (move them to Services/Repositories).

### Step 6: Transaction Management

To ensure Application Services remain independent of Drizzle, we need an abstraction for database transactions.

1.  **Define `src/domain/interfaces/transaction-manager.ts`**
    *   `run<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>`
2.  **Implement `src/infrastructure/db/transaction-manager.ts`**
    *   Implement using `db.transaction`.
3.  **Refactor Services using Transactions**
    *   Inject `ITransactionManager` into services like `BulkOperationService` or `MediaService` (for moves/deletes).

## Verification

*   Run `bun check` to ensure no circular dependencies or type errors.
*   Run existing tests to ensure no regression.
*   Verify that `src/domain` has **zero** imports from `src/infrastructure` (except maybe types if strictly necessary, but preferably not).
*   Verify that `src/application` does not import `drizzle-orm` or `bun:sqlite` directly (except for types if abstracted).

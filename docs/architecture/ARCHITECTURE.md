# Architecture Documentation

**Project**: solid-imager  
**Last Updated**: 2025-10-11  
**Architecture Style**: Clean Architecture / Hexagonal Architecture

## Overview

This project follows a layered architecture pattern inspired by Clean Architecture and Hexagonal Architecture principles. The codebase is organized into distinct layers with clear separation of concerns and well-defined dependency rules.

## Architecture Principles

1. **Dependency Direction**: Dependencies flow inward toward the domain layer
   - Presentation → Application → Domain ← Infrastructure
2. **Domain Independence**: The domain layer has no external dependencies
3. **Testability**: Each layer can be tested independently
4. **Maintainability**: Clear boundaries make code easier to understand and modify
5. **Flexibility**: Infrastructure can be swapped without affecting business logic

## Directory Structure

```
src/
├── domain/              # Business logic, domain models, pure functions
│   ├── media/           # Media domain (types, schemas, processing)
│   ├── sources/         # Media sources domain
│   ├── tags/            # Tags domain
│   ├── categories/      # Categories domain
│   ├── characters/      # Characters domain
│   ├── ips/             # Intellectual properties domain
│   └── shared/          # Cross-domain utilities
│
├── application/         # Use case orchestration, service layer
│   └── services/        # Application services
│       ├── media-service.ts
│       ├── media-source-service.ts
│       ├── thumbnail-service.ts
│       └── ... (19 services total)
│
├── infrastructure/      # External integrations, I/O operations
│   ├── storage/         # Storage drivers (local, SFTP, S3)
│   ├── api-clients/     # API client functions
│   ├── jobs/            # Background job processing
│   └── db/              # Database access layer
│
├── presentation/        # UI layer, routes, components
│   ├── routes/          # API routes and pages (external to layers)
│   ├── components/      # UI components (external to layers)
│   └── utils/           # Presentation utilities (cn.ts)
│
└── shared/              # Cross-cutting concerns (future use)
    ├── types/
    └── constants/
```

## Layer Responsibilities

### 1. Domain Layer (`src/domain/`)

**Purpose**: Contains business logic, domain models, and validation rules. Pure functions with no I/O.

**Characteristics**:
- No dependencies on other layers
- Pure functions (deterministic, no side effects)
- Business rules and validation
- Domain-specific types and schemas

**Files** (17 total):
- `media/types.ts` - Media domain types (Media, MediaMetadata, etc.)
- `media/schemas.ts` - Zod validation schemas for media
- `media/processing/image-processor.ts` - Image processing logic
- `media/utils/path-utils.ts` - Path manipulation utilities
- `media/utils/hash-utils.ts` - Hashing utilities
- `sources/types.ts` - Source types (MediaSourceInfo, ConnectionInfo)
- `sources/schemas.ts` - Source validation schemas
- `shared/types.ts` - Cross-domain types (UUID, AppConfig, etc.)
- `shared/validation.ts` - Schema validation utilities
- Domain-specific types and schemas for: tags, categories, characters, ips

**Guidelines**:
- ✅ DO: Write pure functions
- ✅ DO: Define business rules and validation
- ✅ DO: Create domain-specific types
- ❌ DON'T: Import from infrastructure or application layers
- ❌ DON'T: Perform I/O operations
- ❌ DON'T: Access databases or external APIs

**Example**:
```typescript
// ✅ Good: Pure domain logic
export const calculateAspectRatio = (width: number, height: number): number => {
  return width / height;
};

// ❌ Bad: I/O in domain layer
export const getMediaFromDatabase = async (id: string) => {
  return await db.select().from(media).where(eq(media.id, id));
};
```

### 2. Application Layer (`src/application/`)

**Purpose**: Orchestrates use cases, coordinates between domain and infrastructure.

**Characteristics**:
- Depends on domain layer
- Uses infrastructure through dependency injection or imports
- Coordinates complex workflows
- Transaction boundaries

**Files** (19 total):
- Service files orchestrating business operations:
  - `media-service.ts` - Media management operations
  - `media-source-service.ts` - Source management
  - `thumbnail-service.ts` - Thumbnail generation orchestration
  - `analytics-service.ts`, `bulk-operation-service.ts`, etc.

**Guidelines**:
- ✅ DO: Orchestrate domain logic with infrastructure
- ✅ DO: Handle transaction boundaries
- ✅ DO: Implement use cases
- ✅ DO: Import from domain and infrastructure layers
- ❌ DON'T: Contain business logic (delegate to domain)
- ❌ DON'T: Directly access infrastructure details (use abstractions)

**Example**:
```typescript
// ✅ Good: Service orchestrates domain + infrastructure
export async function processMedia(sourceId: string, filePath: string) {
  // Validate with domain schema
  const validatedSourceId = sourceIdSchema.parse(sourceId);
  
  // Use infrastructure to get file
  const file = await storageDriver.readFile(filePath);
  
  // Use domain logic for processing
  const metadata = await extractMetadata(file);
  
  // Save to database via infrastructure
  return await db.insert(media).values({ sourceId, filePath, metadata });
}
```

### 3. Infrastructure Layer (`src/infrastructure/`)

**Purpose**: Implements external integrations, I/O operations, and technical capabilities.

**Characteristics**:
- Depends on domain layer (for types and interfaces)
- Independent from application layer
- Handles external systems (DB, filesystem, APIs)
- Contains adapters and drivers

**Files** (21 total):
- `storage/` - Storage drivers (local.ts, sftp.ts, s3.ts, factory.ts, types.ts)
- `api-clients/` - API client functions (media.ts, sources.ts, categories.ts, etc.)
- `jobs/` - Background job processing (job-queue.ts, thumbnail-jobs.ts, thumbnails.ts)
- `db/` - Database access (index.ts, schema.ts)

**Guidelines**:
- ✅ DO: Implement technical capabilities
- ✅ DO: Handle I/O operations
- ✅ DO: Use domain types for data structures
- ✅ DO: Throw domain-specific errors
- ❌ DON'T: Import from application layer
- ❌ DON'T: Contain business logic

**Example**:
```typescript
// ✅ Good: Infrastructure adapter
export class LocalDriver implements MediaSourceDriver {
  async readFile(path: string): Promise<Buffer> {
    return await fs.readFile(this.getAbsolutePath(path));
  }
  
  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await fs.access(this.basePath);
      return { success: true };
    } catch {
      return { success: false, message: "Directory not accessible" };
    }
  }
}
```

### 4. Presentation Layer (`src/presentation/`)

**Purpose**: User interface concerns, including utilities specific to UI rendering.

**Characteristics**:
- Depends on application and domain layers
- Contains UI-specific logic
- Handles user input/output

**Files** (1 total):
- `utils/cn.ts` - Tailwind CSS class merging utility

**Note**: Routes (`src/routes/`) and components (`src/components/`) are conceptually part of the presentation layer but remain at the project root due to framework conventions (SolidStart).

**Guidelines**:
- ✅ DO: Handle UI rendering logic
- ✅ DO: Format data for display
- ✅ DO: Process user input
- ✅ DO: Import from any layer as needed
- ❌ DON'T: Contain business logic

### 5. Shared Layer (`src/shared/`)

**Purpose**: Cross-cutting concerns used by multiple layers.

**Status**: Directory structure created for future use. Currently empty.

**Intended Use**:
- Common types used across all layers
- Application-wide constants
- Shared utilities that don't belong to a specific domain

## Dependency Rules

### Allowed Dependencies

```
Presentation Layer
    ↓ (can import from)
Application Layer
    ↓ (can import from)
Domain Layer ← Infrastructure Layer
    (can import from)
```

### Prohibited Dependencies

- ❌ Domain → Infrastructure
- ❌ Domain → Application
- ❌ Domain → Presentation
- ❌ Infrastructure → Application
- ❌ Infrastructure → Presentation

## Migration Summary

### Before (Old Structure)

```
src/
├── lib/              # Mixed concerns
│   ├── api/          # API clients + business logic
│   ├── drivers/      # Storage drivers
│   ├── helpers/      # Mixed utilities
│   ├── types.ts      # All types in one file
│   ├── schemas.ts    # All schemas in one file
│   └── utils.ts      # Single utility
├── services/         # Application services (well-organized)
├── db/               # Database
└── utils/            # Empty
```

**Problems**:
- Business logic mixed with infrastructure (src/lib/api/media.ts)
- Types and schemas not organized by domain
- Helper functions scattered across multiple files
- No clear separation between domain and infrastructure

### After (New Structure)

**Improvements**:
- ✅ Clear separation of concerns (4 distinct layers)
- ✅ Domain logic isolated from I/O
- ✅ Types and schemas organized by domain
- ✅ Infrastructure adapters clearly separated
- ✅ All architectural boundaries enforced
- ✅ 58 files organized across 5 layers (down from 82, eliminated duplication)

## Adding New Code

### Adding a New Domain Concept

1. Create directory in `src/domain/{concept}/`
2. Add `types.ts` for domain types
3. Add `schemas.ts` for validation schemas
4. Add domain logic files as needed

**Example**: Adding a "collections" domain
```
src/domain/collections/
├── types.ts           # Collection, CollectionItem types
├── schemas.ts         # Collection validation schemas
└── utils/
    └── collection-utils.ts  # Pure collection logic
```

### Adding a New Service

1. Create file in `src/application/services/`
2. Import domain types and schemas
3. Use infrastructure through imports
4. Orchestrate business operations

**Example**: Adding a collection service
```typescript
// src/application/services/collection-service.ts
import type { Collection } from "~/domain/collections/types";
import { collectionSchema } from "~/domain/collections/schemas";
import { db } from "~/infrastructure/db";

export async function createCollection(data: unknown): Promise<Collection> {
  const validated = collectionSchema.parse(data);
  return await db.insert(collections).values(validated);
}
```

### Adding Infrastructure Integration

1. Create adapter in `src/infrastructure/{type}/`
2. Implement interfaces defined in domain
3. Use domain types for data structures

**Example**: Adding a new storage driver
```typescript
// src/infrastructure/storage/dropbox.ts
import type { MediaSourceDriver } from "./types";

export class DropboxDriver implements MediaSourceDriver {
  async readFile(path: string): Promise<Buffer> {
    // Implementation using Dropbox SDK
  }
  
  async testConnection(): Promise<{ success: boolean }> {
    // Test Dropbox connection
  }
}
```

## Testing Strategy

### Domain Layer Tests
- Focus on business logic correctness
- Use pure input/output assertions
- No mocking required (pure functions)

### Application Layer Tests
- Mock infrastructure dependencies
- Test use case orchestration
- Verify error handling

### Infrastructure Layer Tests
- Integration tests with real external systems (use test databases)
- Test adapter behavior
- Verify error handling for I/O failures

### Presentation Layer Tests
- UI component tests
- User interaction flows
- Format/display logic

## Common Patterns

### Dependency Injection

Services receive dependencies through constructor or function parameters:

```typescript
export async function processMediaWithStorage(
  storage: MediaSourceDriver,
  filePath: string
) {
  const file = await storage.readFile(filePath);
  return processFile(file);
}
```

### Error Handling

Throw domain-specific errors that can be caught at presentation layer:

```typescript
// Domain layer
export class MediaNotFoundError extends Error {
  constructor(id: string) {
    super(`Media ${id} not found`);
  }
}

// Application layer
export async function getMedia(id: string): Promise<Media> {
  const media = await db.select().from(media).where(eq(media.id, id));
  if (!media) throw new MediaNotFoundError(id);
  return media;
}

// Presentation layer (route)
try {
  return json(await getMedia(params.id));
} catch (error) {
  if (error instanceof MediaNotFoundError) {
    return json({ error: error.message }, { status: 404 });
  }
  throw error;
}
```

### Validation Pattern

Use Zod schemas from domain layer at entry points:

```typescript
// Domain
export const createMediaSchema = z.object({
  sourceId: z.string().uuid(),
  filePath: z.string().min(1),
  // ...
});

// Application service
export async function createMedia(data: unknown) {
  const validated = createMediaSchema.parse(data); // Throws ZodError if invalid
  return await db.insert(media).values(validated);
}

// Route handler
export async function POST({ request }: APIEvent) {
  try {
    const body = await request.json();
    return json(await createMedia(body));
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: "Validation failed", issues: error.issues }, { status: 400 });
    }
    throw error;
  }
}
```

## Architecture Decision Records

See [ADR-001: Adopt Clean Architecture](./ADR-001-clean-architecture.md) for rationale behind this architecture.

## References

- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Feature Specification](../../specs/005-src-lib-utils/spec.md)
- [Implementation Plan](../../specs/005-src-lib-utils/plan.md)
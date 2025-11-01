# ADR-002: Database Schema Consistency and Refactoring

**Status**: Accepted
**Date**: 2025-10-20
**Deciders**: Development Team
**Related**: Database Schema Design

## Context

During a comprehensive schema consistency review, we identified several design inconsistencies across the database schema:

1. **ID Type Inconsistency**: Mix of UUID (media sources, media, users, collections, jobs) and SERIAL (tags, categories, projects, ips, characters, similar_media, view_history)
2. **media_organization Design**: Single table with nullable foreign keys (category_id, project_id, ip_id) preventing many-to-many relationships
3. **Intermediate Table Naming**: Inconsistent naming pattern - some tables follow `entity1_entity2` pattern (e.g., `media_tags`, `media_characters`), while others follow `entity2_entity1` pattern (e.g., `collection_media`)
4. **source Column Inconsistency**: Present in tags, ips, and characters, but missing in categories despite similar use cases
5. **Media Table Timestamps**: Unique pattern with `created_at`, `modified_at`, `indexed_at` instead of standard `created_at`/`updated_at`
6. **updated_at Inconsistency**: Present in some tables (media_sources, users, collections, jobs) but missing in others (tags, categories, ips, characters, projects)
7. **description Default Values**: Some tables use NULL (ips, characters, collections), others use empty string ('')
8. **collections/users Relationship**: Not fully analyzed in previous review

### Previous Schema Issues

- **Single Media Assignment**: A media item could only belong to one category, one project, and one IP
- **Naming Confusion**: `collection_media` vs `media_tags` - no consistent pattern
- **Metadata Gaps**: Missing source tracking for categories, missing update timestamps for core entities
- **Type Inconsistency**: NULL vs empty string for description fields made queries more complex

## Decision

We will refactor the database schema with the following changes:

### 1. ID Type Strategy
**Decision**: Keep as-is (hybrid approach)
- **Rationale**: UUID for entities requiring external uniqueness or distribution (media, sources, users)
- **Rationale**: SERIAL for simple lookup tables with sequential numbering

### 2. Many-to-Many Relationships
**Decision**: Refactor `media_organization` into three separate many-to-many tables
- `media_categories` (media_id, category_id)
- `media_projects` (media_id, project_id)
- `media_ips` (media_id, ip_id)
- Move `status` column to `media` table

**Rationale**:
- A media item can belong to multiple categories, projects, and IPs
- Separate tables allow independent relationship management
- Better query performance with targeted indexes

### 3. Naming Convention
**Decision**: Standardize all intermediate tables to `media_{entity}` pattern
- Rename `collection_media` → `media_collections`
- Existing: `media_tags`, `media_characters` (already follow pattern)
- New: `media_categories`, `media_projects`, `media_ips`

**Rationale**:
- Consistent pattern improves discoverability
- Groups all media relationships together
- Follows common convention of `{primary_entity}_{related_entity}`

### 4. Source Column
**Decision**: Add `source` column to `categories` table with default 'manual'

**Rationale**:
- Categories can be manually created by users
- Future AI categorization features will need source tracking
- Maintains consistency with tags, ips, and characters

### 5. Media Table Timestamps
**Decision**: Keep existing `created_at`, `modified_at`, `indexed_at` pattern

**Rationale**:
- Intentional design to track three different timestamps:
  - `created_at`: Original file creation time
  - `modified_at`: File modification time (from filesystem)
  - `indexed_at`: Database insertion time
- Different from standard `created_at`/`updated_at` which track database record lifecycle
- Provides valuable forensic information for media management

### 6. updated_at Columns
**Decision**: Add `updated_at` to tags, categories, ips, characters, and projects

**Rationale**:
- Enables tracking when metadata was last modified
- Useful for synchronization and audit trails
- Should be consistent across all user-editable entities

### 7. Description Default Values
**Decision**: Prefer empty string ('') over NULL for all description fields

**Rationale**:
- Simplifies queries (no need for `IS NULL` checks)
- More JavaScript-friendly (no null handling needed)
- Cleaner TypeScript types (string vs string | null)
- Consistent with existing defaults in other tables

### 8. Status Management
**Decision**: Move `status` from `media_organization` to `media` table

**Rationale**:
- Status (active/archived/deleted) is a property of the media itself
- Not dependent on category/project/IP relationships
- Simplifies queries (no join required to check status)

## Implementation

### Schema Changes

```typescript
// Old: Single table with nullable FKs
media_organization {
  media_id (PK)
  category_id (nullable)
  project_id (nullable)
  ip_id (nullable)
  status
}

// New: Separate many-to-many tables
media_categories {
  media_id (PK, FK)
  category_id (PK, FK)
}

media_projects {
  media_id (PK, FK)
  project_id (PK, FK)
}

media_ips {
  media_id (PK, FK)
  ip_id (PK, FK)
}

media {
  // ... existing columns ...
  status (moved from media_organization)
}
```

### Added Columns

- `media.status` - Media lifecycle status
- `tags.updated_at` - Last tag modification
- `categories.source` - Category origin tracking
- `categories.updated_at` - Last category modification
- `ips.created_at` - IP creation timestamp
- `ips.updated_at` - Last IP modification
- `characters.created_at` - Character creation timestamp
- `characters.updated_at` - Last character modification
- `projects.updated_at` - Last project modification

### Modified Columns

- `ips.description`: DEFAULT NULL → DEFAULT ''
- `characters.description`: DEFAULT NULL → DEFAULT ''
- `collections.description`: DEFAULT NULL → DEFAULT ''

### Renamed Tables

- `collection_media` → `media_collections`

### Removed Tables

- `media_organization` (replaced by `media_categories`, `media_projects`, `media_ips`)

## Migration Strategy

1. Created new many-to-many tables (`media_categories`, `media_projects`, `media_ips`)
2. Added new columns to existing tables
3. Migrated existing data from `media_organization` to new tables
4. Moved `status` column to `media` table
5. Dropped old `media_organization` table
6. Renamed `collection_media` to `media_collections`
7. Updated all indexes and foreign key constraints

Migration file: `drizzle/0001_parallel_nova.sql`

## Consequences

### Positive

1. **✅ True Many-to-Many**: Media can now belong to multiple categories, projects, and IPs simultaneously
2. **✅ Consistent Naming**: All intermediate tables follow `media_{entity}` pattern
3. **✅ Better Tracking**: Source and update timestamp tracking across all editable entities
4. **✅ Simpler Queries**: Empty string defaults eliminate NULL handling in application code
5. **✅ Better Performance**: Targeted indexes on smaller tables improve query speed
6. **✅ Clearer Ownership**: Status directly on media table clarifies that it's a media property
7. **✅ Future-Proof**: Source column on categories enables future AI categorization

### Negative

1. **❌ More Tables**: 3 new tables increase schema complexity slightly
2. **❌ Migration Effort**: Existing code using `media_organization` must be updated
3. **❌ Breaking Change**: API responses and queries need adjustment

### Neutral

1. **↔️ ID Strategy**: Hybrid UUID/SERIAL approach maintained (intentional)
2. **↔️ Media Timestamps**: Unique three-timestamp pattern preserved (intentional)

## Alternatives Considered

### Alternative 1: Keep media_organization with JSONB

Use JSONB arrays for multiple relationships:

```sql
media_organization {
  media_id (PK)
  category_ids JSONB  -- [1, 5, 12]
  project_ids JSONB   -- [3, 7]
  ip_ids JSONB        -- [2]
  status
}
```

**Pros**:
- Single table
- No additional tables needed

**Cons**:
- Poor query performance (JSONB index limitations)
- Difficult to maintain referential integrity
- Complex join queries
- No standard SQL support for array relationships

**Decision**: Rejected - violates relational design principles

### Alternative 2: Unified Naming as entity1_entity2

Rename to alphabetical order: `categories_media`, `collections_media`, `characters_media`

**Pros**:
- Strictly alphabetical pattern
- Database-neutral convention

**Cons**:
- Less intuitive (media is the primary entity)
- Breaks existing convention (`media_tags`, `media_characters`)
- Requires renaming more tables

**Decision**: Rejected - `media_{entity}` better reflects primary entity

### Alternative 3: Keep NULL for description

Maintain NULL as default for optional description fields

**Pros**:
- Semantic difference between "no description" (NULL) and "empty description" ('')
- Slightly smaller storage for NULL

**Cons**:
- Requires NULL checks in all queries
- More complex TypeScript types (string | null)
- Inconsistent with existing defaults

**Decision**: Rejected - empty string is more practical

## Validation

### Breaking Changes

- API endpoints using `media_organization` must be updated
- Frontend code querying categories/projects/IPs needs adjustment
- Existing seeds/fixtures need migration

### Verification Steps

1. ✅ Schema migrations generated successfully
2. ✅ Database migrations applied without errors
3. ✅ All foreign key constraints valid
4. ✅ Indexes created on new tables
5. ✅ Documentation updated (04-database-design.md)
6. ✅ Type exports updated in schema.ts

## Future Considerations

1. **Relationship Metadata**: Consider adding metadata to intermediate tables (e.g., `media_categories.assigned_by`, `media_categories.assigned_at`)
2. **Soft Deletes**: Consider using `status = 'deleted'` instead of hard deletes
3. **Audit Trail**: Consider separate audit tables for tracking all changes
4. **Multi-tenancy**: If needed, consider adding tenant_id to all tables

## References

- [Database Design Documentation](../design/04-database-design.md)
- [Drizzle ORM Schema Reference](https://orm.drizzle.team/docs/schemas)
- Previous conversation: Schema consistency review (2025-10-20)

## Revision History

- **2025-10-20**: Initial version - documented database schema refactoring decisions

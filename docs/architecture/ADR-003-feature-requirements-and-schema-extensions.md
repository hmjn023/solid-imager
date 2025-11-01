# ADR-003: Feature Requirements and Schema Extensions

**Status**: Accepted
**Date**: 2025-10-20
**Deciders**: Development Team
**Related**: ADR-002, Database Schema Design

## Context

After establishing the database schema consistency (ADR-002), we conducted a comprehensive Q&A session to clarify feature requirements and determine necessary schema extensions. This ADR documents the decisions made during that session.

## Decision Summary

Through 15 questions across all major functional areas, we clarified requirements and decided on schema extensions needed to support the intended features.

## Detailed Decisions

### 1. Media Source Management

**Question**: How to handle multiple paths per media source (e.g., ComfyUI multiple output folders)?

**Decision**: Create separate sources (A)
- Each folder becomes an independent media source
- Simple and manageable
- Easy per-source enable/disable control

**Rationale**: Simplicity over flexibility. Managing independent sources is more straightforward than complex path arrays.

### 2. Deletion Behavior

**Question**: When `media.status = 'deleted'`, should physical files also be deleted?

**Decision**: Logical deletion only (A)
- Change DB record `status` to `deleted`
- Keep physical files intact for recovery
- No automatic physical file deletion

**Rationale**: Safety first. Users can recover from accidental deletions. Storage is cheaper than data loss.

### 3. Tag Attributes

**Question**: Should `tags.attribute` be free-form or enumerated?

**Decision**: Free-form input with application-level control (A)
- DB allows any TEXT value
- Application provides suggestions and validation
- Future flexibility for new attribute types

**Rationale**: Flexibility without database migrations. New attribute types can be added without schema changes.

### 4. Category Hierarchy

**Question**: How many hierarchy levels for categories?

**Decision**: 2-3 levels expected, unlimited technically supported (B intention, unlimited capability)
- Current `parent_id` design supports unlimited depth
- UI implementation will handle deep hierarchies

**Rationale**: Existing schema already supports this. No changes needed.

### 5. Project Management

**Question**: Add start_date, end_date, status fields to projects?

**Decision**: No additional fields (B)
- Keep current design (name, description, created_at, updated_at, archived_at)
- Simple and sufficient

**Rationale**: YAGNI (You Aren't Gonna Need It). Add complexity only when clearly needed.

### 6. Character Management

**Question 6-1**: Register all characters in a media or only main characters?

**Decision**: Register all characters (A)
- Record every character present in media
- Enables detailed search capabilities

**Question 6-2**: How to handle character aliases (e.g., "Reimu", "博麗霊夢", "Reimu Hakurei")?

**Decision**: Add `characters.aliases JSONB` column (A)
```sql
ALTER TABLE characters ADD COLUMN aliases JSONB;
-- Example: {"aliases": ["霊夢", "Reimu", "Reimu Hakurei"]}
```

**Rationale**: JSONB provides flexibility for variable number of aliases without complex joins.

### 7. AI Generation Information

**Question 7-1**: Store ComfyUI workflow JSON in `metadata` or separate column?

**Decision**: Add dedicated columns for prompt and workflow

**Question 7-2**: Need LoRA/Hypernetwork/VAE information?

**Decision**: Add dedicated columns for model information

**Schema Changes**:
```sql
ALTER TABLE media_generation_info
  ADD COLUMN prompt TEXT,
  ADD COLUMN negative_prompt TEXT,
  ADD COLUMN workflow JSONB,
  ADD COLUMN loras JSONB,              -- [{"name": "...", "weight": 0.8}]
  ADD COLUMN vae TEXT,
  ADD COLUMN hypernetworks JSONB,
  ADD COLUMN embeddings JSONB;
```

**Rationale**: Dedicated columns enable efficient querying and indexing. ComfyUI workflow and generation parameters are first-class data, not generic metadata.

### 8. Media Relations

**Question 8-1**: Can same parent-child pair have multiple relation_types?

**Decision**: Yes, possible (A) - keep current schema
- Current `UNIQUE(parent_media_id, child_media_id, relation_type)` allows this
- Example: Same pair can be both 'version' and 'edit'

**Question 8-2**: Support multi-level hierarchies (parent → child → grandchild)?

**Decision**: No, 2 levels only (B)
- Parent-child relationships only
- No grandchildren tracking

**Rationale**: Simplicity. Two levels cover most use cases (variants, pages, versions). Multi-level would complicate queries unnecessarily.

### 9. Similar Media Search

**Question 9-1**: Batch processing or on-demand similarity calculation?

**Decision**: Hybrid approach (C)
- Calculate similarity when new media is added (batch with existing media)
- Also support on-demand calculation when needed
- Cache results in `similar_media` table

**Question 9-2**: Which algorithms to support?

**Decision**: Multiple algorithms (A)
- `perceptual` - Perceptual hash (pHash, dHash)
- `feature_vector` - CNN features (ResNet/VGG)
- `clip_embedding` - CLIP embeddings
- `color_histogram` - Color histogram comparison
- `ssim` - Structural similarity

**Rationale**: Different algorithms excel at different similarity types. Perceptual for duplicates, CLIP for semantic similarity, etc.

### 10. View History & Statistics

**Question**: Add `user_id`, anonymize IP, set retention period?

**Decision**: Defer for future (postponed)
- `view_history` table exists but won't be implemented initially
- Reconsider when actually needed

**Rationale**: Not critical for MVP. Focus on core media management features first.

### 11. Backup & Sync

**Question 11-1**: Automatic or manual backup?

**Decision**: Manual backup (B)
- User explicitly triggers backup
- Or admin initiates bulk operation

**Question 11-2**: Record backup timestamps?

**Decision**: Yes, add tracking columns (A)
```sql
ALTER TABLE media_sync
  ADD COLUMN last_synced_at TIMESTAMP,
  ADD COLUMN sync_attempts INTEGER DEFAULT 0,
  ADD COLUMN last_error TEXT;
```

**Rationale**: Manual control gives users flexibility. Timestamps enable monitoring and troubleshooting.

### 12. Collections

**Question**: Public/private settings? Sharing features?

**Decision**: Defer for future (postponed)
- Single-user deployment assumed
- Multi-user features not currently needed

**Rationale**: Complexity not justified for single-user usage. Can add when multi-user support is needed.

### 13. Background Jobs

**Question**: Priority, retry, scheduling features?

**Decision**: Application-layer control (B)
- Handle priority/retry/scheduling in application code
- No additional DB columns needed

**Rationale**: These are execution concerns, not data model concerns. Application layer is appropriate place.

### 14. Filter Presets

**Question**: Per-user presets or global sharing?

**Decision**: Global sharing (B)
- Current design (no `user_id`)
- All users share same presets
- Keep simple

**Rationale**: Single-user deployment. No need for per-user isolation.

### 15. User Management

**Question 15-1**: Use `users` table?

**Decision**: Keep for future but don't use now (C)
- Table remains in schema
- No authentication implementation

**Question 15-2**: Authentication required?

**Decision**: No authentication (B)
- Local/trusted environment usage
- Open access

**Rationale**: Single-user local tool. Authentication adds unnecessary friction.

## Implementation

### Required Schema Changes

1. **characters table**:
   ```sql
   ALTER TABLE characters ADD COLUMN aliases JSONB;
   ```

2. **media_generation_info table**:
   ```sql
   ALTER TABLE media_generation_info
     ADD COLUMN prompt TEXT,
     ADD COLUMN negative_prompt TEXT,
     ADD COLUMN workflow JSONB,
     ADD COLUMN loras JSONB,
     ADD COLUMN vae TEXT,
     ADD COLUMN hypernetworks JSONB,
     ADD COLUMN embeddings JSONB;
   ```

3. **media_sync table**:
   ```sql
   ALTER TABLE media_sync
     ADD COLUMN last_synced_at TIMESTAMP,
     ADD COLUMN sync_attempts INTEGER DEFAULT 0,
     ADD COLUMN last_error TEXT;
   ```

### No Changes Required

The following were decided to keep as-is or defer:
- Media sources (use multiple sources for multiple paths)
- Deletion behavior (logical deletion with existing `status`)
- Tag attributes (free-form TEXT)
- Category hierarchy (existing `parent_id` sufficient)
- Projects (no additional fields)
- Media relations (existing schema covers requirements)
- Similar media (existing schema covers requirements)
- View history (defer)
- Collections (defer multi-user features)
- Jobs (application-layer control)
- Presets (current global sharing)
- Users (keep table but don't use)

## Consequences

### Positive

1. **✅ Clear Feature Scope**: All major functional areas have defined requirements
2. **✅ Minimal Schema Changes**: Only 3 tables need modifications
3. **✅ Future-Proof**: Deferred features have clear paths for future implementation
4. **✅ Focused Development**: Single-user, local-first approach simplifies initial implementation
5. **✅ Rich AI Support**: Comprehensive storage for AI generation parameters and models
6. **✅ Flexible Character Management**: Aliases support international and alternate names

### Negative

1. **❌ Limited Multi-User**: Current design assumes single user
2. **❌ No Authentication**: Open access may not suit all deployment scenarios
3. **❌ Manual Backup**: Users must remember to backup

### Neutral

1. **↔️ Deferred Features**: Many features postponed but not rejected
2. **↔️ Application-Layer Logic**: Some complexity moved to application code

## Future Considerations

Features explicitly deferred for future implementation:
- View history and analytics
- Multi-user support and authentication
- Collection sharing and permissions
- User roles and access control
- Automatic backup scheduling
- Advanced job prioritization

## Validation

### Success Criteria

- ✅ All 15 questions answered with clear decisions
- ✅ Schema changes identified and documented
- ✅ Rationale provided for each decision
- ✅ Future extension paths preserved

## References

- [ADR-002: Database Schema Consistency](./ADR-002-database-schema-consistency.md)
- [Feature Capabilities Documentation](../design/05-feature-capabilities.md)
- [Database Design](../design/04-database-design.md)

## Revision History

- **2025-10-20**: Initial version - documented Q&A session decisions and schema extensions

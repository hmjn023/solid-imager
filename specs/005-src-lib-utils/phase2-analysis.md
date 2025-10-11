# Phase 2 Analysis Results

**Date**: 2025-10-11  
**Status**: Completed (T011-T016)

## T011: Types from src/lib/types.ts (28 types)

### Domain Categorization:

**Media Domain (8 types)**:
- AddMediaToCollectionRequest
- BulkEditMediaUpdates
- BulkTagMediaOptions
- MediaMetadata
- MediaSearchParams
- MediaUpdateData
- ThumbnailProgress
- UploadRequest

**Sources Domain (10 types)**:
- CloneSourceRequest
- ConnectionInfo
- CreateDirectoryRequest
- DeleteDirectoryRequest
- FileSystemEvent
- LocalConnectionInfo
- MediaSourceInfo
- MediaSourceTypeEnum
- S3Connection
- SftpConnection
- UpdateDirectoryRequest

**Categories Domain (1 type)**:
- CategoryData

**Characters Domain (1 type)**:
- CharacterData

**IPs Domain (1 type)**:
- IpData

**Shared/Cross-Domain (7 types)**:
- AppConfig
- CollectionData
- ImportData
- SearchOptions
- UserData
- UUID

---

## T012: Schemas from src/lib/schemas.ts (7 schemas)

**Media Domain (5 schemas)**:
- addMediaRequestSchema
- updateMediaRequestSchema
- mediaIdSchema
- mediaTypeSchema
- directoryPathSchema

**Sources Domain (2 schemas)**:
- sourceIdSchema
- localConnectionSchema

---

## T013: Files Importing from ~/lib/types (28 files)

**API Routes (19 files)**:
- src/routes/api/sources/[sourceId]/index.ts
- src/routes/api/sources/[sourceId]/[mediaId]/tags.ts
- src/routes/api/sources/[sourceId]/[mediaId]/index.ts
- src/routes/api/sources/[sourceId]/[mediaId]/details.ts
- src/routes/api/sources/[sourceId]/[mediaId]/metadata.ts
- src/routes/api/sources/[sourceId]/[mediaId]/upload.ts
- src/routes/api/sources/[sourceId]/status.ts
- src/routes/api/sources/[sourceId]/directories/index.ts
- src/routes/api/sources/[sourceId]/directories/create.ts
- src/routes/api/sources/[sourceId]/directories/delete.ts
- src/routes/api/sources/[sourceId]/directories/[...directories]/search.ts
- src/routes/api/sources/[sourceId]/directories/[...directories]/index.ts
- src/routes/api/sources/[sourceId]/directories/rename.ts
- src/routes/api/sources/[sourceId]/search.ts
- src/routes/api/sources/[sourceId]/thumbnails/index.ts
- src/routes/api/sources/[sourceId]/events.ts
- src/routes/api/config.ts

**Components (3 files)**:
- src/components/source-card.tsx
- src/components/source-delete-modal.tsx
- src/components/source-form-modal.tsx

**Library Files (1 file)**:
- src/lib/api/config.ts

**Services (1 file)**:
- src/services/media-source-service.ts

**Tests (6 files)**:
- src/tests/api/sources/[sourceId]/[mediaId]/charactors.test.ts
- src/tests/api/sources/[sourceId]/[mediaId]/details.test.ts
- src/tests/api/sources/[sourceId]/[mediaId]/ips.test.ts
- src/tests/api/sources/[sourceId]/[mediaId]/metadata.test.ts
- src/tests/api/sources/[sourceId]/[mediaId]/tags.test.ts

**Most Commonly Imported Types**:
- UUID (21 files)
- MediaSourceInfo (4 files)
- MediaSourceTypeEnum (2 files)
- AppConfig (2 files)

---

## T014: Files Importing from ~/lib/schemas (14 files)

**Library Files (3 files)**:
- src/lib/api/media.ts (imports: addMediaRequestSchema, directoryPathSchema, mediaIdSchema, sourceIdSchema, updateMediaRequestSchema)
- src/lib/drivers/factory.ts (imports: localConnectionSchema)
- src/lib/drivers/types.ts (imports: directoryPathSchema, localConnectionSchema, mediaIdSchema, sourceIdSchema, updateMediaRequestSchema)

**Tests (10 files)**:
- src/tests/api/media/addMedia.test.ts
- src/tests/api/media/add-media.test.ts
- src/tests/api/media/getMedia.test.ts
- src/tests/api/media/get-media.test.ts
- src/tests/api/media/deleteMedia.test.ts
- src/tests/api/media/delete-media.test.ts
- src/tests/api/media/list-media.test.ts
- src/tests/api/media/listMedia.test.ts
- src/tests/api/media/update-media.test.ts
- src/tests/api/media/updateMedia.test.ts

---

## T015: Analysis of src/lib/api/media.ts

**CRITICAL FINDING**: This file is **misnamed** - it's NOT an API client, it's business logic/service layer code!

### Functions and Their Correct Placement:

**Business Logic Functions** (should go to application/services/media-service.ts):
1. **addMedia()** - Validates, checks duplicates, inserts into database
2. **getMedia()** - Validates, queries database
3. **updateMedia()** - Validates, updates database
4. **deleteMedia()** - Validates, deletes from database, triggers thumbnail deletion
5. **registerExistingMedia()** - Scans directory, extracts metadata with sharp, manages thumbnail job queue
6. **listMedia()** - Queries database for directory contents
7. **getMediaDetails()** - Stub calling getMedia()
8. **getMediaMetadata()** - Stub for metadata extraction
9. **getMediaTags()** - Stub for tag retrieval
10. **getMediaThumbnail()** - Stub (not implemented)
11. **uploadMedia()** - Stub (not implemented)
12. **searchMediaInDirectory()** - Stub calling listMedia()
13. **searchMedia()** - Stub (not implemented)

**Utility Functions**:
- **getFiles()** - Recursive directory traversal (should go to domain/media/utils/)

**Constants**:
- **SUPPORTED_MEDIA_TYPES** - Array of supported extensions (should go to domain/media/ or shared/constants/)

**Dependencies**:
- Database operations (~/db)
- Thumbnail operations (~/lib/thumbnails)
- Thumbnail jobs (~/services/thumbnail-jobs)
- Sharp (image processing)
- Node fs, path

### Migration Strategy:

Option A (Recommended): Most of this logic should be **consolidated into src/services/media-service.ts** (which already exists), NOT moved to infrastructure/api-clients/.

Option B: If we need to keep this as a separate module, it should go to **application/services/media-operations.ts** or similar.

**DO NOT** create infrastructure/api-clients/media.ts from this file - there are no API client functions here!

---

## T016: Analysis of src/lib/helpers/storage-drivers.ts

### Storage Drivers (3 drivers):

**1. LocalDriver** (constant object):
- readFile(path): Promise<Buffer>
- writeFile(path, content): Promise<void>
- deleteFile(path): Promise<void>
- listDirectory(path): Promise<string[]>
- createDirectory(path): Promise<void>
- deleteDirectory(path): Promise<void>
- renamePath(oldPath, newPath): Promise<void>

**Destination**: src/infrastructure/storage/local.ts (but check if src/lib/drivers/local.ts already implements this)

**2. SftpDriver** (constant object):
- connect(connectionInfo): Promise<unknown>
- readFile(connectionInfo, remotePath): Promise<Buffer>
- writeFile(connectionInfo, remotePath, content): Promise<void>
- deleteFile(connectionInfo, remotePath): Promise<void>
- listDirectory(connectionInfo, remotePath): Promise<string[]>

**Destination**: src/infrastructure/storage/sftp.ts

**3. S3Driver** (constant object):
- init(connectionInfo): unknown
- getObject(connectionInfo, key): Promise<Buffer>
- putObject(connectionInfo, key, content): Promise<void>
- deleteObject(connectionInfo, key): Promise<void>
- listObjects(connectionInfo, prefix): Promise<string[]>

**Destination**: src/infrastructure/storage/s3.ts

### Types Defined:

**SftpConnection** type:
- host: string
- port: number
- username: string
- password?: string
- privateKey?: string

**S3Connection** type:
- accessKeyId: string
- secretAccessKey: string
- region: string
- bucket: string

**Note**: These connection types are duplicates! They're already defined in src/lib/types.ts. During migration, use the domain/sources/types.ts versions and delete these duplicates.

### Implementation Status:

All three drivers are **TODO stubs** (not implemented). All functions throw "Not implemented" errors.

---

## Key Decisions for Phase 3:

1. **Skip infrastructure/api-clients/media.ts**: The src/lib/api/media.ts file should be consolidated into application/services/media-service.ts, NOT moved to infrastructure.

2. **Avoid Type Duplication**: SftpConnection and S3Connection types already exist in src/lib/types.ts. Use those and don't duplicate them in storage-drivers.ts.

3. **Check for Existing Implementations**: src/lib/drivers/local.ts already exists - check if it's a duplicate of LocalDriver in storage-drivers.ts before creating infrastructure/storage/local.ts.

4. **Type Import Updates**: When splitting types.ts, all 28 import locations will need careful updating with the correct domain path.

5. **Schema Import Updates**: 14 files import schemas - ensure each gets the correct domain-specific schema path.

---

## Next Steps (Phase 3):

Begin creating domain layer type and schema files:
- T017-T018: Create src/domain/media/types.ts and schemas.ts
- T019-T020: Create src/domain/sources/types.ts and schemas.ts
- T021-T028: Create remaining domain type/schema files
- T029: Create src/domain/shared/types.ts

All Phase 3 tasks (T017-T029) can run in parallel as they create new files with no dependencies.

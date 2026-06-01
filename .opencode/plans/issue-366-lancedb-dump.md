# Plan: Issue #366 - LanceDB dump/restore format

## Overview

Add LanceDB format support for media source dump/restore. LanceDB provides columnar compression (1/5~1/10 of JSON size) and zero-copy Arrow reads.

## Design

- **LanceDB stores**: metadata + optional image binary in `imageData` column
- **UI**: 3 buttons (JSON / ZIP / LanceDB). LanceDB shows confirmation modal for "include images?"
- **Archive format**: tar.gz containing LanceDB directory (and images/ dir if not embedded)

## Implementation Steps

### 1. P0: Bun smoke test (COMPLETED)
- [x] Install `@lancedb/lancedb` + `apache-arrow` (v21.x)
- [x] Verify LanceDB works with Bun (connect, createTable, query)
- [x] Verify binary data (Buffer/Uint8Array) works in LanceDB columns

### 2. P0: Create `lancedb-dump-service.ts`
- [ ] Arrow schema definition matching `MediaDumpItem`
- [ ] `writeToLanceDB(items, { includeImages, getImageBuffer })` - chunked insert (5000 items)
- [ ] `readFromLanceDB(dir, { extractImages, saveImageBuffer })` - read + optional image extraction
- [ ] `cleanupLanceDBDir(dir)` - temp dir cleanup

### 3. P1: Modify `backup-service.ts`
- [ ] Add `"lancedb"` to `createDump()` mode enum
- [ ] Add `includeImages` option parameter
- [ ] LanceDB mode: temp dir → LanceDB write → tar.gz → stream return
- [ ] `restoreSource()` LanceDB format detection (check for `.lance` directory in tar)

### 4. P1: Router / API client / UI
- [ ] `sources-router.ts`: add `"lancedb"` to dump input mode enum
- [ ] `sources-api.ts`: `fetchSourceDump` support `"lancedb"`
- [ ] UI: Add LanceDB button next to JSON/ZIP buttons
- [ ] UI: Confirmation modal "Include media files in LanceDB?" on LanceDB button click

### 5. P2: Tests
- [ ] LanceDB round-trip test (dump → restore)
- [ ] Test with/without embedded images

## Files to Create/Modify

| File | Action |
|------|--------|
| `apps/server/src/application/services/lancedb-dump-service.ts` | CREATE |
| `apps/server/src/application/services/backup-service.ts` | MODIFY |
| `apps/server/src/infrastructure/api/routers/sources-router.ts` | MODIFY |
| `apps/server/src/infrastructure/api-clients/sources-api.ts` | MODIFY |
| `apps/server/src/routes/sources/$mediaSourceId/index.tsx` | MODIFY |
| `apps/server/package.json` | MODIFY (deps already added) |

# Runtime Abstraction Plan

## Summary

Existing Node/Tauri differences should be organized by responsibility rather than by implementation details so later Rust/Tauri work can be introduced safely. This plan fixes the abstraction boundaries for `fs`, `db bootstrap`, `media processing`, `yt-dlp/downloads`, `runtime capabilities`, and `AppClient`, and defines how to phase out direct dependencies on `ServerMediaStorage`, `ImageProcessor`, and current `PGlite` bootstrap wiring.

`comfyUI` metadata handling is explicitly split into:

- reading raw comments / EXIF / embedded workflow data from media files
- interpreting prompt/workflow content into tags and metadata

The second stage remains pure shared logic in core.

## Key Changes

### 1. File System / Path

- Keep `IFileSystem` and continue to hide Node/Tauri differences in `NodeFileSystem` and `TauriFileSystem`.
- Remove direct `node:fs`, `node:path`, and `process.cwd()` usage from upper layers.
- Introduce `IPathService` if upper layers still need `join`, `dirname`, `basename`, `extname`, or normalization behavior.
- Treat `mkdtemp`, `stat`, and `readdir` as implementation concerns; upper layers must not rely on Node-specific behavior.

### 2. Database Bootstrap

- Do not re-abstract repositories or Drizzle.
- Limit database abstraction to bootstrap only.
- Add:
  - `createDatabase(runtime)`
  - `createPgliteStorage(runtime)`
- `runtime=server` keeps the current PostgreSQL / PGlite branching.
- `runtime=tauri` is fixed to PGlite, with persistence delegated to a Tauri-backed storage adapter.
- Refactor `db/index.ts` so it no longer hard-depends on `process.env` and Node path behavior.

### 3. Media Processing

- Keep `IImageProcessor` only as a temporary compatibility facade.
- Split its internal responsibilities into:
  - `IMetadataExtractor`
  - `IThumbnailGenerator`
  - `IMediaProbe`
- `IMetadataExtractor`
  - reads raw metadata from image files
  - returns prompt/workflow/tags-ready data
- `IThumbnailGenerator`
  - generates image/video thumbnails
- `IMediaProbe`
  - returns `width`, `height`, and `size`
  - may later extend to `duration`, `mime`, and codec data
- Keep `extractDataFromComments` and related tag extraction logic in core.
- Do not create an `ffmpeg` abstraction directly. Rust, `sharp`, or `ffmpeg` implementations should sit behind the responsibility-based interfaces above.
- Plan to remove direct `ImageProcessor` / `ServerMediaStorage` references from `media-processing-service`, `download-jobs`, and `sync-router`.

### 4. Media Storage

- Keep `IMediaStorage`, but narrow its role to:
  - save / read / copy media
  - expose file metadata needed after persistence
- Move probing responsibilities currently embedded in `ServerMediaStorage` toward `IMediaProbe`.
- Do not expand `IMediaStorage` into an ffmpeg/sharp-style processing abstraction.
- Move consumers like `bidirectional-sync-service`, `media-processing-service`, `sync-router`, and `download-jobs` toward `services.getMediaStorage()`.

### 5. Downloads / yt-dlp

- Add `IDownloadBackend`.
- Minimum responsibilities:
  - `getCapabilities()`
  - `fetchMetadata()`
  - `enqueueDownload()` or `download()`
- Server implementation wraps the current `yt-dlp` path.
- Tauri implementation returns `unsupported`.
- Future server delegation is modeled as a separate `RemoteDownloadBackend`.
- UI should use runtime/backend capabilities for disabling or hiding unsupported flows.
- The current `__TAURI_BUILD__` branching in `download-jobs.ts` should later be replaced by backend injection.

### 6. Runtime Capabilities

- Replace flat boolean-only capability flags with backend-kind descriptors.
- Suggested shape:
  - `storage: 'local' | 'unsupported'`
  - `database: 'pglite' | 'postgres' | 'unsupported'`
  - `mediaProcessing: 'rust' | 'sharp-ffmpeg' | 'unsupported'`
  - `downloads: 'local' | 'remote' | 'unsupported'`
  - `aiTagging: 'remote' | 'unsupported'`
- UI-facing `supportsXxx` values should be derived from these backend selections.
- `RuntimeCapabilities` should be the source of truth for feature enablement and backend choice, not just environment detection.

### 7. AppClient

- Keep `AppClient`, but structure it as a collection of feature clients:
  - `SourcesClient`
  - `MediaClient`
  - `ConfigClient`
  - `SyncClient`
  - `ImportsClient`
  - optionally `DownloadsClient`
- Web uses oRPC-backed implementations.
- Tauri uses local/backend-aware implementations.
- Server uses direct router client implementations.
- UI should depend on feature clients rather than `orpc` directly.
- `AppClient` is an operation boundary for the UI, not a transport mirror.

## Important Interfaces / Types

- Keep:
  - `IFileSystem`
  - `IMediaStorage`
  - `IConfigService`
  - `AppClient`
- Add:
  - `IPathService` when path operations are formally extracted
  - `createDatabase(runtime)`
  - `createPgliteStorage(runtime)`
  - `IMetadataExtractor`
  - `IThumbnailGenerator`
  - `IMediaProbe`
  - `IDownloadBackend`
- Change:
  - `RuntimeCapabilities` to a backend-kind-based structure
- Temporary compatibility:
  - `IImageProcessor` remains as a facade during migration

## Implementation Order

1. Redefine `RuntimeCapabilities` around backend kinds.
2. Add `createDatabase(runtime)` and `createPgliteStorage(runtime)`.
3. Introduce `IMetadataExtractor`, `IThumbnailGenerator`, and `IMediaProbe`, then reduce `IImageProcessor` to a facade.
4. Move metadata/probe work out of `ServerMediaStorage` into `IMediaProbe`.
5. Replace direct `ServerMediaStorage` / `ImageProcessor` usage in processing, sync, and download code with injected dependencies.
6. Introduce `IDownloadBackend` and wrap current `yt-dlp` behavior behind it.
7. Refactor `AppClient` into feature clients and remove transport coupling from UI code.

## Test Plan

- Type-level:
  - new abstractions remain compatible with existing service/repository boundaries
  - `IImageProcessor` facade preserves current call sites during transition
- Unit:
  - `IMetadataExtractor` + `extractDataFromComments` preserve current `comfyUI` tag extraction behavior
  - `IMediaProbe` returns correct `width`, `height`, and `size` for image/video inputs
  - `IDownloadBackend` unsupported implementation returns consistent capability and runtime failure behavior
- Integration:
  - `media-processing-service` runs against injected backends instead of direct static singletons
  - `PGlite` bootstrap switches correctly between server/test/tauri runtimes
- Regression:
  - existing media upload, thumbnail generation, metadata extraction, sync, and download flows keep their current observable behavior
  - `comfyUI` workflow extraction works for both embedded prompt JSON and workflow comment sources

## Assumptions

- Full Tauri/Rust implementation comes later; this document only fixes abstraction boundaries.
- Tauri database remains PGlite-based.
- `yt-dlp` stays unsupported in local Tauri runtime for now.
- Rust backends are the future replacement target for `sharp` and `ffmpeg`, but this plan only standardizes interfaces first.
- `comfyUI` workflow/prompt interpretation remains in shared pure logic, not runtime-specific implementations.

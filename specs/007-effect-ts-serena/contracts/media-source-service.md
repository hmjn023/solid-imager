# Contract: Media Source Service

This document outlines the change in function signatures for `media-source-service.ts` as it is refactored from a Promise-based implementation to an Effect-based one.

## `getMediaSources`

**Before (Promise-based):**
```typescript
import type { MediaSource } from "~/infrastructure/db/schema";

async function getMediaSources(): Promise<MediaSource[]>
```

**After (Effect-based):**
```typescript
import { Effect } from "effect";
import type { MediaSource } from "~/infrastructure/db/schema";
import type { DbError } from "~/infrastructure/db/errors";

function getMediaSources(): Effect.Effect<MediaSource[], DbError>
```

---

## `createMediaSource`

**Before (Promise-based):**
```typescript
import type { NewMediaSource } from "~/infrastructure/db/schema";

async function createMediaSource(mediaSource: NewMediaSource): Promise<MediaSource[]>
```

**After (Effect-based):**
```typescript
import { Effect } from "effect";
import type { NewMediaSource, MediaSource } from "~/infrastructure/db/schema";
import type { DbError } from "~/infrastructure/db/errors";

function createMediaSource(mediaSource: NewMediaSource): Effect.Effect<MediaSource[], DbError>
```

---

## `updateMediaSource`

**Before (Promise-based):**
```typescript
import type { NewMediaSource } from "~/infrastructure/db/schema";

async function updateMediaSource(id: string, data: Partial<NewMediaSource>): Promise<any> // Return type was any
```

**After (Effect-based):**
```typescript
import { Effect } from "effect";
import type { NewMediaSource, MediaSource } from "~/infrastructure/db/schema";
import type { DbError } from "~/infrastructure/db/errors";

function updateMediaSource(id: string, data: Partial<NewMediaSource>): Effect.Effect<MediaSource[], DbError>
```

---

## `deleteMediaSource`

**Before (Promise-based):**
```typescript
async function deleteMediaSource(sourceId: string): Promise<any> // Return type was any
```

**After (Effect-based):**
```typescript
import { Effect } from "effect";
import type { MediaSource } from "~/infrastructure/db/schema";
import type { DbError } from "~/infrastructure/db/errors";

function deleteMediaSource(sourceId: string): Effect.Effect<MediaSource[], DbError>
```

/**
 * Sources API Client
 * Extracted from src/lib/api/sources.ts
 */

import { Effect, pipe } from "effect";
import {
  FetchError,
  MediaSourceService,
} from "~/application/services/media-source-service";
import type { NewMediaSource } from "~/infrastructure/db/schema";
import { getDriver } from "~/infrastructure/storage/factory";

const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

export function getMediaSources() {
  return MediaSourceService.fetchSources();
}

export function getMediaSourceById(sourceId: string) {
  return MediaSourceService.fetchSourceById(sourceId);
}

export function createMediaSource(mediaSource: NewMediaSource) {
  return MediaSourceService.createSource(mediaSource);
}

export function updateMediaSource(
  sourceId: string,
  data: Partial<NewMediaSource>
) {
  return MediaSourceService.updateSource(sourceId, data);
}

export function deleteMediaSource(sourceId: string) {
  return MediaSourceService.deleteSource(sourceId);
}

export function testMediaSourceConnection(sourceId: string) {
  return Effect.tryPromise({
    try: async () => {
      const source = await pipe(
        MediaSourceService.fetchSourceById(sourceId),
        Effect.runPromise
      );
      if (!source) {
        throw new FetchError(
          "指定されたメディアソースが見つかりません",
          HTTP_STATUS_NOT_FOUND
        );
      }
      const driver = getDriver(source);
      const connectionTest = await driver.testConnection();
      if (!connectionTest.success) {
        throw new FetchError(
          `接続に失敗しました: ${connectionTest.message ?? "不明なエラー"}`,
          HTTP_STATUS_INTERNAL_SERVER_ERROR
        );
      }
      return connectionTest;
    },
    catch: (error) => {
      if (error instanceof FetchError) {
        return error;
      }
      return new FetchError(
        `Failed to test media source connection: ${error}`,
        HTTP_STATUS_INTERNAL_SERVER_ERROR
      );
    },
  });
}

export function getMediaSourceStatus(sourceId: string) {
  return pipe(
    testMediaSourceConnection(sourceId),
    Effect.map((test) => ({
      sourceId,
      status: test.success ? "active" : "error",
      message: test.message,
      lastChecked: new Date(),
    })),
    Effect.catchAll((error) =>
      Effect.succeed({
        sourceId,
        status: "error",
        message: error.message,
        lastChecked: new Date(),
      })
    )
  );
}

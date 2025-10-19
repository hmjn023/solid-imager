/**
 * Sources API Client
 * Extracted from src/lib/api/sources.ts
 */

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

export async function testMediaSourceConnection(sourceId: string) {
  try {
    const source = await MediaSourceService.fetchSourceById(sourceId);
    if (!source || source.length === 0) {
      // fetchSourceById returns array
      throw new FetchError(
        "指定されたメディアソースが見つかりません",
        HTTP_STATUS_NOT_FOUND
      );
    }
    const driver = getDriver(source[0]); // Assuming fetchSourceById returns an array of one source
    const connectionTest = await driver.testConnection();
    if (!connectionTest.success) {
      throw new FetchError(
        `接続に失敗しました: ${connectionTest.message ?? "不明なエラー"}`,
        HTTP_STATUS_INTERNAL_SERVER_ERROR
      );
    }
    return connectionTest;
  } catch (error: unknown) {
    if (error instanceof FetchError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new FetchError(
      `Failed to test media source connection: ${errorMessage}`,
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
}

export async function getMediaSourceStatus(sourceId: string) {
  try {
    const test = await testMediaSourceConnection(sourceId);
    return {
      sourceId,
      status: test.success ? "active" : "error",
      message: test.message,
      lastChecked: new Date(),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      sourceId,
      status: "error",
      message: errorMessage,
      lastChecked: new Date(),
    };
  }
}

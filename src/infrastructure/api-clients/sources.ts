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

/**
 * Fetches all media sources from the MediaSourceService.
 * @returns {Promise<MediaSource[]>} A promise that resolves with an array of media source objects.
 */
export function getMediaSources() {
  return MediaSourceService.fetchSources();
}

/**
 * Fetches a specific media source by its ID from the MediaSourceService.
 * @param {string} sourceId - The ID of the media source to fetch.
 * @returns {Promise<(MediaSource | undefined)[]>} A promise that resolves with an array containing the media source, or undefined if not found.
 */
export function getMediaSourceById(sourceId: string) {
  return MediaSourceService.fetchSourceById(sourceId);
}

/**
 * Creates a new media source using the MediaSourceService.
 * @param {NewMediaSource} mediaSource - The data for the new media source.
 * @returns {Promise<MediaSource[]>} A promise that resolves with an array containing the newly created media source.
 */
export function createMediaSource(mediaSource: NewMediaSource) {
  return MediaSourceService.createSource(mediaSource);
}

/**
 * Updates an existing media source using the MediaSourceService.
 * @param {string} sourceId - The ID of the media source to update.
 * @param {Partial<NewMediaSource>} data - The partial data to update the media source with.
 * @returns {Promise<MediaSource[]>} A promise that resolves with an array containing the updated media source.
 */
export function updateMediaSource(
  sourceId: string,
  data: Partial<NewMediaSource>
) {
  return MediaSourceService.updateSource(sourceId, data);
}

/**
 * Deletes a media source using the MediaSourceService.
 * @param {string} sourceId - The ID of the media source to delete.
 * @returns {Promise<MediaSource[]>} A promise that resolves with an array containing the deleted media source.
 */
export function deleteMediaSource(sourceId: string) {
  return MediaSourceService.deleteSource(sourceId);
}

/**
 * Tests the connection to a specified media source.
 * @param {string} sourceId - The ID of the media source to test.
 * @returns {Promise<any>} A promise that resolves with the connection test result.
 * @throws {FetchError} If the media source is not found or the connection fails.
 */
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

/**
 * Retrieves the status of a specified media source by testing its connection.
 * @param {string} sourceId - The ID of the media source to get the status for.
 * @returns {Promise<{ sourceId: string; status: "active" | "error"; message?: string; lastChecked: Date }>} A promise that resolves with the status of the media source.
 */
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

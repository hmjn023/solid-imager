/**
 * Directories API Client
 * Extracted from src/lib/api/directories.ts
 */

import { MediaSourceService } from "~/application/services/media-source-service";
import { getDriver } from "~/infrastructure/storage/factory";

/**
 * Retrieves a listing of files and subdirectories within a specified path of a media source.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} [path=""] - The path within the media source to list. Defaults to the root.
 * @returns {Promise<any>} A promise that resolves with the directory listing.
 * @throws {Error} If the specified media source is not found.
 */
export async function getDirectoryListing(sourceId: string, path = "") {
  const sources = await MediaSourceService.fetchSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  return driver.list(path);
}

/**
 * Creates a new directory within a specified media source.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} path - The parent path where the new directory will be created.
 * @param {string} name - The name of the new directory.
 * @returns {Promise<{ success: boolean; fullPath: string }>} A promise that resolves with the success status and the full path of the created directory.
 * @throws {Error} If the specified media source is not found.
 */
export async function createDirectory(
  sourceId: string,
  path: string,
  name: string
) {
  const sources = await MediaSourceService.fetchSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  const fullPath = `${path}/${name}`;
  await driver.createDirectory(fullPath);
  return { success: true, fullPath };
}

/**
 * Renames or moves a directory within a specified media source.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} oldPath - The current path of the directory.
 * @param {string} newPath - The new path/name for the directory.
 * @returns {Promise<{ success: boolean; oldPath: string; newPath: string }>} A promise that resolves with the success status and the old and new paths.
 * @throws {Error} If the specified media source is not found.
 */
export async function renameDirectory(
  sourceId: string,
  oldPath: string,
  newPath: string
) {
  const sources = await MediaSourceService.fetchSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  await driver.rename(oldPath, newPath);
  return { success: true, oldPath, newPath };
}

/**
 * Deletes a directory within a specified media source.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} path - The path of the directory to delete.
 * @returns {Promise<{ success: boolean; path: string }>} A promise that resolves with the success status and the path of the deleted directory.
 * @throws {Error} If the specified media source is not found.
 */
export async function deleteDirectory(sourceId: string, path: string) {
  const sources = await MediaSourceService.fetchSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  await driver.delete(path);
  return { success: true, path };
}

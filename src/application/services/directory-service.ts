import { getMediaSourceById } from "~/infrastructure/api-clients/sources";
import { getDriver } from "~/infrastructure/storage/factory";

/**
 * DirectoryService - ディレクトリ管理機能
 * Feature 9: ディレクトリ管理機能
 */

/**
 * Provides services for managing directories within media sources.
 */
export const DirectoryService = {
  /**
   * Retrieves the directory tree structure for a given media source.
   * @param {string} _sourceId - The ID of the media source.
   * @returns {any} The directory tree structure.
   */
  getDirectoryTree(_sourceId: string) {
    // TODO: Get directory tree structure
    throw new Error("Not implemented");
  },

  /**
   * Creates a new directory within a specified media source.
   * @param {string} _sourceId - The ID of the media source.
   * @param {object} _directoryData - The data for the new directory.
   * @param {string} _directoryData.path - The path where the new directory should be created.
   * @param {string} _directoryData.name - The name of the new directory.
   * @returns {any} Confirmation of directory creation.
   */
  createDirectory(
    _sourceId: string,
    _directoryData: { path: string; name: string }
  ) {
    // TODO: Create new directory
    throw new Error("Not implemented");
  },

  /**
   * Deletes a directory within a specified media source.
   * @param {string} _sourceId - The ID of the media source.
   * @param {string} _directoryPath - The path of the directory to delete.
   * @param {boolean} [_force] - If true, forces deletion even if the directory is not empty.
   * @returns {any} Confirmation of directory deletion.
   */
  deleteDirectory(_sourceId: string, _directoryPath: string, _force?: boolean) {
    // TODO: Delete directory (force=true required for non-empty)
    throw new Error("Not implemented");
  },

  /**
   * Renames or moves a directory within a specified media source.
   * @param {string} _sourceId - The ID of the media source.
   * @param {object} _directoryData - The data for updating the directory.
   * @param {string} _directoryData.oldPath - The current path of the directory.
   * @param {string} _directoryData.newPath - The new path/name for the directory.
   * @returns {any} Confirmation of directory update.
   */
  updateDirectory(
    _sourceId: string,
    _directoryData: { oldPath: string; newPath: string }
  ) {
    // TODO: Rename/move directory
    throw new Error("Not implemented");
  },

  /**
   * Lists media files and subdirectories within a specified subdirectory of a media source.
   * @param {string} sourceId - The ID of the media source.
   * @param {string} directoriesPath - The path to the subdirectory to list.
   * @returns {Promise<any>} A promise that resolves with a list of media and directories.
   */
  async listMediaInSubdirectory(sourceId: string, directoriesPath: string) {
    const [source] = await getMediaSourceById(sourceId);
    if (!source) {
      throw new Error("Media source not found");
    }
    const driver = getDriver(source);
    return driver.list(directoriesPath);
  },
};

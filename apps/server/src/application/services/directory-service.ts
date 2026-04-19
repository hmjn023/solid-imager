import { MediaSourceService } from "~/application/services/media-source-service";
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
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @returns {any} The directory tree structure.
	 */
	getDirectoryTree(mediaSourceId: string) {
		// For now, we just return the root listing as a tree
		// In a real implementation, this might be recursive or return a nested structure
		return this.listMediaInSubdirectory(mediaSourceId, "");
	},

	/**
	 * Creates a new directory within a specified media source.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {object} directoryData - The data for the new directory.
	 * @param {string} directoryData.path - The path where the new directory should be created.
	 * @param {string} directoryData.name - The name of the new directory.
	 * @returns {any} Confirmation of directory creation.
	 */
	async createDirectory(mediaSourceId: string, directoryData: { path: string; name: string }) {
		const [source] = await MediaSourceService.fetchSourceById(mediaSourceId);
		if (!source) {
			throw new Error("Media source not found");
		}
		const driver = getDriver(source);
		const fullPath = `${directoryData.path}/${directoryData.name}`;
		await driver.createDirectory(fullPath);
		return { success: true, fullPath };
	},

	/**
	 * Deletes a directory within a specified media source.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {string} directoryPath - The path of the directory to delete.
	 * @param {boolean} [force] - If true, forces deletion even if the directory is not empty.
	 * @returns {any} Confirmation of directory deletion.
	 */
	async deleteDirectory(mediaSourceId: string, directoryPath: string, _force?: boolean) {
		const [source] = await MediaSourceService.fetchSourceById(mediaSourceId);
		if (!source) {
			throw new Error("Media source not found");
		}
		const driver = getDriver(source);
		// Driver delete might need to handle force/recursive
		await driver.delete(directoryPath);
		return { success: true, path: directoryPath };
	},

	/**
	 * Renames or moves a directory within a specified media source.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {object} directoryData - The data for updating the directory.
	 * @param {string} directoryData.oldPath - The current path of the directory.
	 * @param {string} directoryData.newPath - The new path/name for the directory.
	 * @returns {any} Confirmation of directory update.
	 */
	async updateDirectory(
		mediaSourceId: string,
		directoryData: { oldPath: string; newPath: string },
	) {
		const [source] = await MediaSourceService.fetchSourceById(mediaSourceId);
		if (!source) {
			throw new Error("Media source not found");
		}
		const driver = getDriver(source);
		await driver.rename(directoryData.oldPath, directoryData.newPath);
		return {
			success: true,
			oldPath: directoryData.oldPath,
			newPath: directoryData.newPath,
		};
	},

	/**
	 * Lists media files and subdirectories within a specified subdirectory of a media source.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {string} directoriesPath - The path to the subdirectory to list.
	 * @returns {Promise<any>} A promise that resolves with a list of media and directories.
	 */
	async listMediaInSubdirectory(mediaSourceId: string, directoriesPath: string) {
		const [source] = await MediaSourceService.fetchSourceById(mediaSourceId);
		if (!source) {
			throw new Error("Media source not found");
		}
		const driver = getDriver(source);
		return driver.list(directoriesPath);
	},
};

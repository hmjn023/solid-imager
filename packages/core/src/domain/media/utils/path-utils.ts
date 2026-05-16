/**
 * Path Utilities
 * Extracted from src/lib/helpers/utils.ts
 * Feature 17.5: ユーティリティ関数
 */

/**
 * Provides utility functions for manipulating file paths.
 */
export const PathUtils = {
	/**
	 * Resolves a relative path against a base path.
	 * @param {string} _basePath - The base path.
	 * @param {string} _relativePath - The relative path to resolve.
	 * @returns {string} The resolved absolute path.
	 */
	resolveRelativePath(_basePath: string, _relativePath: string): string {
		// TODO: Resolve relative path from base path
		throw new Error("Not implemented");
	},

	/**
	 * Extracts the filename from a given file path.
	 * @param {string} _filePath - The full file path.
	 * @returns {string} The filename, including its extension.
	 */
	getFileName(_filePath: string): string {
		// TODO: Extract filename from path
		throw new Error("Not implemented");
	},

	/**
	 * Extracts the file extension from a given file path.
	 * @param {string} _filePath - The full file path.
	 * @returns {string} The file extension (e.g., "png", "jpg").
	 */
	getFileExtension(_filePath: string): string {
		// TODO: Extract file extension from path
		throw new Error("Not implemented");
	},
};

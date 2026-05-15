/**
 * Path Utilities
 * Extracted from src/lib/helpers/utils.ts
 * Feature 17.5: ユーティリティ関数
 */

/**
 * Normalises a relative path to POSIX-style forward slashes and collapses
 * consecutive separators.
 */
export function normalizeRelativePath(path: string): string {
	return path.replace(/[\\/]+/g, "/");
}

/**
 * Returns `true` if any segment of the path starts with a dot (hidden file
 * or directory).
 */
export function isHiddenPath(filePath: string): boolean {
	return filePath
		.split(/[\\/]/)
		.filter(Boolean)
		.some((segment) => segment.startsWith("."));
}

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
		throw new Error("Not implemented");
	},

	/**
	 * Extracts the filename from a given file path.
	 * @param {string} _filePath - The full file path.
	 * @returns {string} The filename, including its extension.
	 */
	getFileName(_filePath: string): string {
		throw new Error("Not implemented");
	},

	/**
	 * Extracts the file extension from a given file path.
	 * @param {string} _filePath - The full file path.
	 * @returns {string} The file extension (e.g., "png", "jpg").
	 */
	getFileExtension(_filePath: string): string {
		throw new Error("Not implemented");
	},
};

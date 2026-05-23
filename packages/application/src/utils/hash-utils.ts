import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

/**
 * Hash Utilities
 * Moved from @solid-imager/core to apps/server due to Node.js dependency.
 */

/**
 * Provides utility functions for generating various types of hashes for media files.
 */
export const HashUtils = {
	/**
	 * Generates an MD5 hash for a given file.
	 * @param {string} filePath - The path to the file.
	 * @returns {Promise<string>} A promise that resolves with the MD5 hash as a string.
	 */
	async generateMd5(filePath: string): Promise<string> {
		const hash = createHash("md5");
		const input = createReadStream(filePath);
		await pipeline(input, hash);
		return hash.digest("hex");
	},

	/**
	 * Generates a perceptual hash for a given file, used for similarity detection.
	 * @param {string} _filePath - The path to the file.
	 * @returns {Promise<string>} A promise that resolves with the perceptual hash as a string.
	 */
	generatePerceptualHash(_filePath: string): Promise<string> {
		// TODO: Generate perceptual hash for similarity detection
		throw new Error("Not implemented");
	},
};

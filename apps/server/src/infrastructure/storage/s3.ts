/**
 * S3 Storage Driver
 * Extracted from src/lib/helpers/storage-drivers.ts
 */

import type { S3Connection } from "@solid-imager/core/domain/sources/schemas";

/**
 * Provides functionalities for interacting with AWS S3 storage.
 */
export const S3Driver = {
	/**
	 * Initializes the S3 client with the provided connection information.
	 * @param {S3Connection} _connectionInfo - The S3 connection details.
	 * @returns {unknown} The initialized S3 client instance.
	 */
	init(_connectionInfo: S3Connection): unknown {
		// TODO: Initialize S3 client
		throw new Error("Not implemented");
	},

	/**
	 * Retrieves an object from the S3 bucket.
	 * @param {S3Connection} _connectionInfo - The S3 connection details.
	 * @param {string} _key - The key (path) of the object to retrieve.
	 * @returns {Promise<Buffer>} A promise that resolves with the object content as a Buffer.
	 */
	getObject(_connectionInfo: S3Connection, _key: string): Promise<Buffer> {
		// TODO: Get object from S3
		throw new Error("Not implemented");
	},

	/**
	 * Uploads an object to the S3 bucket.
	 * @param {S3Connection} _connectionInfo - The S3 connection details.
	 * @param {string} _key - The key (path) where the object will be stored.
	 * @param {Buffer} _content - The content of the object to upload.
	 * @returns {Promise<void>} A promise that resolves when the object has been uploaded.
	 */
	putObject(
		_connectionInfo: S3Connection,
		_key: string,
		_content: Buffer,
	): Promise<void> {
		// TODO: Put object to S3
		throw new Error("Not implemented");
	},

	/**
	 * Deletes an object from the S3 bucket.
	 * @param {S3Connection} _connectionInfo - The S3 connection details.
	 * @param {string} _key - The key (path) of the object to delete.
	 * @returns {Promise<void>} A promise that resolves when the object has been deleted.
	 */
	deleteObject(_connectionInfo: S3Connection, _key: string): Promise<void> {
		// TODO: Delete object from S3
		throw new Error("Not implemented");
	},

	/**
	 * Lists objects within an S3 bucket with a given prefix.
	 * @param {S3Connection} _connectionInfo - The S3 connection details.
	 * @param {string} _prefix - The prefix to filter the objects by.
	 * @returns {Promise<string[]>} A promise that resolves with an array of object keys.
	 */
	listObjects(
		_connectionInfo: S3Connection,
		_prefix: string,
	): Promise<string[]> {
		// TODO: List S3 objects with prefix
		throw new Error("Not implemented");
	},
};

/**
 * SFTP Storage Driver
 * Extracted from src/lib/helpers/storage-drivers.ts
 */

import type { SftpConnection } from "~/domain/sources/types";

/**
 * Provides functionalities for interacting with SFTP storage.
 */
export const SftpDriver = {
  /**
   * Establishes an SFTP connection using the provided connection information.
   * @param {SftpConnection} _connectionInfo - The SFTP connection details.
   * @returns {Promise<unknown>} A promise that resolves with the SFTP client instance.
   */
  connect(_connectionInfo: SftpConnection): Promise<unknown> {
    // TODO: Establish SFTP connection
    throw new Error("Not implemented");
  },

  /**
   * Reads the content of a file from the SFTP server.
   * @param {SftpConnection} _connectionInfo - The SFTP connection details.
   * @param {string} _remotePath - The remote path to the file.
   * @returns {Promise<Buffer>} A promise that resolves with the file content as a Buffer.
   */
  readFile(
    _connectionInfo: SftpConnection,
    _remotePath: string
  ): Promise<Buffer> {
    // TODO: Read file from SFTP server
    throw new Error("Not implemented");
  },

  /**
   * Writes content to a file on the SFTP server.
   * @param {SftpConnection} _connectionInfo - The SFTP connection details.
   * @param {string} _remotePath - The remote path where the file will be written.
   * @param {Buffer} _content - The content to write to the file.
   * @returns {Promise<void>} A promise that resolves when the file has been written.
   */
  writeFile(
    _connectionInfo: SftpConnection,
    _remotePath: string,
    _content: Buffer
  ): Promise<void> {
    // TODO: Write file to SFTP server
    throw new Error("Not implemented");
  },

  /**
   * Deletes a file from the SFTP server.
   * @param {SftpConnection} _connectionInfo - The SFTP connection details.
   * @param {string} _remotePath - The remote path to the file to delete.
   * @returns {Promise<void>} A promise that resolves when the file has been deleted.
   */
  deleteFile(
    _connectionInfo: SftpConnection,
    _remotePath: string
  ): Promise<void> {
    // TODO: Delete file from SFTP server
    throw new Error("Not implemented");
  },

  /**
   * Lists the contents of a directory on the SFTP server.
   * @param {SftpConnection} _connectionInfo - The SFTP connection details.
   * @param {string} _remotePath - The remote path to the directory to list.
   * @returns {Promise<string[]>} A promise that resolves with an array of file and directory names.
   */
  listDirectory(
    _connectionInfo: SftpConnection,
    _remotePath: string
  ): Promise<string[]> {
    // TODO: List SFTP directory contents
    throw new Error("Not implemented");
  },
};

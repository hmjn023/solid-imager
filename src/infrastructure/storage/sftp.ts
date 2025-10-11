/**
 * SFTP Storage Driver
 * Extracted from src/lib/helpers/storage-drivers.ts
 */

import type { SftpConnection } from "~/domain/sources/types";

export const SftpDriver = {
  async connect(_connectionInfo: SftpConnection): Promise<unknown> {
    // TODO: Establish SFTP connection
    throw new Error("Not implemented");
  },

  async readFile(
    _connectionInfo: SftpConnection,
    _remotePath: string
  ): Promise<Buffer> {
    // TODO: Read file from SFTP server
    throw new Error("Not implemented");
  },

  async writeFile(
    _connectionInfo: SftpConnection,
    _remotePath: string,
    _content: Buffer
  ): Promise<void> {
    // TODO: Write file to SFTP server
    throw new Error("Not implemented");
  },

  async deleteFile(
    _connectionInfo: SftpConnection,
    _remotePath: string
  ): Promise<void> {
    // TODO: Delete file from SFTP server
    throw new Error("Not implemented");
  },

  async listDirectory(
    _connectionInfo: SftpConnection,
    _remotePath: string
  ): Promise<string[]> {
    // TODO: List SFTP directory contents
    throw new Error("Not implemented");
  },
};

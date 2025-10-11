/**
 * Storage Drivers - ストレージドライバー抽象化
 * Feature 17.1: ファイルシステム / ストレージドライバー
 */

// ========================================
// Local Driver
// ========================================

export const LocalDriver = {
  async readFile(_path: string): Promise<Buffer> {
    // TODO: Read file from local filesystem
    throw new Error("Not implemented");
  },

  async writeFile(_path: string, _content: Buffer): Promise<void> {
    // TODO: Write file to local filesystem
    throw new Error("Not implemented");
  },

  async deleteFile(_path: string): Promise<void> {
    // TODO: Delete file from local filesystem
    throw new Error("Not implemented");
  },

  async listDirectory(_path: string): Promise<string[]> {
    // TODO: List directory contents
    throw new Error("Not implemented");
  },

  async createDirectory(_path: string): Promise<void> {
    // TODO: Create directory
    throw new Error("Not implemented");
  },

  async deleteDirectory(_path: string): Promise<void> {
    // TODO: Delete directory
    throw new Error("Not implemented");
  },

  async renamePath(_oldPath: string, _newPath: string): Promise<void> {
    // TODO: Rename/move file or directory
    throw new Error("Not implemented");
  },
};

// ========================================
// SFTP Driver
// ========================================

type SftpConnection = {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
};

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

// ========================================
// S3 Driver
// ========================================

type S3Connection = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
};

export const S3Driver = {
  init(_connectionInfo: S3Connection): unknown {
    // TODO: Initialize S3 client
    throw new Error("Not implemented");
  },

  async getObject(
    _connectionInfo: S3Connection,
    _key: string
  ): Promise<Buffer> {
    // TODO: Get object from S3
    throw new Error("Not implemented");
  },

  async putObject(
    _connectionInfo: S3Connection,
    _key: string,
    _content: Buffer
  ): Promise<void> {
    // TODO: Put object to S3
    throw new Error("Not implemented");
  },

  async deleteObject(
    _connectionInfo: S3Connection,
    _key: string
  ): Promise<void> {
    // TODO: Delete object from S3
    throw new Error("Not implemented");
  },

  async listObjects(
    _connectionInfo: S3Connection,
    _prefix: string
  ): Promise<string[]> {
    // TODO: List S3 objects with prefix
    throw new Error("Not implemented");
  },
};

/**
 * DirectoryService - ディレクトリ管理機能
 * Feature 9: ディレクトリ管理機能
 */

export const DirectoryService = {
  // Feature 9: ディレクトリ管理機能 (Phase 1: local only)
  async getDirectoryTree(_sourceId: string) {
    // TODO: Get directory tree structure
    throw new Error("Not implemented");
  },

  async createDirectory(
    _sourceId: string,
    _directoryData: { path: string; name: string }
  ) {
    // TODO: Create new directory
    throw new Error("Not implemented");
  },

  async deleteDirectory(
    _sourceId: string,
    _directoryPath: string,
    _force?: boolean
  ) {
    // TODO: Delete directory (force=true required for non-empty)
    throw new Error("Not implemented");
  },

  async updateDirectory(
    _sourceId: string,
    _directoryData: { oldPath: string; newPath: string }
  ) {
    // TODO: Rename/move directory
    throw new Error("Not implemented");
  },

  async listMediaInSubdirectory(_sourceId: string, _directoriesPath: string) {
    // TODO: List media in specific subdirectory
    throw new Error("Not implemented");
  },
};

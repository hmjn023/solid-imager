import { getMediaSourceById } from "~/infrastructure/api-clients/sources";
import { getDriver } from "~/infrastructure/storage/factory";

/**
 * DirectoryService - ディレクトリ管理機能
 * Feature 9: ディレクトリ管理機能
 */

export const DirectoryService = {
  // Feature 9: ディレクトリ管理機能 (Phase 1: local only)
  getDirectoryTree(_sourceId: string) {
    // TODO: Get directory tree structure
    throw new Error("Not implemented");
  },

  createDirectory(
    _sourceId: string,
    _directoryData: { path: string; name: string }
  ) {
    // TODO: Create new directory
    throw new Error("Not implemented");
  },

  deleteDirectory(_sourceId: string, _directoryPath: string, _force?: boolean) {
    // TODO: Delete directory (force=true required for non-empty)
    throw new Error("Not implemented");
  },

  updateDirectory(
    _sourceId: string,
    _directoryData: { oldPath: string; newPath: string }
  ) {
    // TODO: Rename/move directory
    throw new Error("Not implemented");
  },

  async listMediaInSubdirectory(sourceId: string, directoriesPath: string) {
    const [source] = await getMediaSourceById(sourceId);
    if (!source) {
      throw new Error("Media source not found");
    }
    const driver = getDriver(source);
    return driver.list(directoriesPath);
  },
};

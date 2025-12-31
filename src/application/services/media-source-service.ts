import { cache } from "@solidjs/router";
import type {
  MediaSource,
  NewMediaSource,
} from "~/domain/repositories/source-repository";
import type { MediaSource as DbMediaSource } from "~/infrastructure/db/schema";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";

/**
 * Custom error class for fetch operations.
 */
export class FetchError {
  readonly _tag = "FetchError";
  readonly message: string;
  readonly status?: number;
  constructor(message: string, status?: number) {
    this.message = message;
    this.status = status;
  }
}

const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// Initialize repository
const sourceRepo = new DrizzleSourceRepository();

const fetchSourcesServer = cache(async (): Promise<MediaSource[]> => {
  "use server";
  return await sourceRepo.findAll();
}, "fetchSources");

const createSourceServer = async (
  sourceData: NewMediaSource
): Promise<MediaSource[]> => {
  "use server";
  const result = await sourceRepo.create(sourceData);
  return [result];
};

const updateSourceServer = async (
  mediaSourceId: string,
  sourceData: Partial<MediaSource>
): Promise<MediaSource[]> => {
  "use server";
  const result = await sourceRepo.update(mediaSourceId, sourceData);
  return [result];
};

const fetchSourceByIdServer = cache(
  async (mediaSourceId: string): Promise<(MediaSource | undefined)[]> => {
    "use server";
    try {
      const result = await sourceRepo.findById(mediaSourceId);
      return result ? [result] : [];
    } catch (_error) {
      return [];
    }
  },
  "fetchSourceById"
);

const deleteSourceServer = async (
  mediaSourceId: string
): Promise<MediaSource[]> => {
  "use server";
  // The repository currently returns void for delete(), but the service expects MediaSource[].
  // We fetch it first before deleting to satisfy the return type if needed.
  const source = await sourceRepo.findById(mediaSourceId);
  await sourceRepo.delete(mediaSourceId);
  return source ? [source] : [];
};

/**
 * Tests the connection to a specified media source.
 * @param {string} mediaSourceId - The ID of the media source to test.
 * @returns {Promise<any>} A promise that resolves with the connection test result.
 */
const testConnectionServer = async (mediaSourceId: string) => {
  "use server";
  const { getDriver } = await import("~/infrastructure/storage/factory");

  try {
    const source = await sourceRepo.findById(mediaSourceId);
    if (!source) {
      throw new FetchError(
        "指定されたメディアソースが見つかりません",
        HTTP_STATUS_NOT_FOUND
      );
    }
    const toDbMediaSource = (s: MediaSource): DbMediaSource =>
      ({
        id: s.id,
        name: s.name,
        description: s.description || null,
        type: s.type,
        connectionInfo: s.connectionInfo,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }) as DbMediaSource;
    const driver = getDriver(toDbMediaSource(source));
    const connectionTest = await driver.testConnection();
    if (!connectionTest.success) {
      throw new FetchError(
        `接続に失敗しました: ${connectionTest.message ?? "不明なエラー"}`,
        HTTP_STATUS_INTERNAL_SERVER_ERROR
      );
    }
    return connectionTest;
  } catch (error: unknown) {
    if (error instanceof FetchError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new FetchError(
      `Failed to test media source connection: ${errorMessage}`,
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
};

const getStatusServer = async (mediaSourceId: string) => {
  "use server";
  try {
    const test = await testConnectionServer(mediaSourceId);
    return {
      mediaSourceId,
      status: test.success ? "active" : "error",
      message: test.message,
      lastChecked: new Date(),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      mediaSourceId,
      status: "error",
      message: errorMessage,
      lastChecked: new Date(),
    };
  }
};

export const MediaSourceService = {
  fetchSources: fetchSourcesServer,
  createSource: createSourceServer,
  updateSource: updateSourceServer,
  fetchSourceById: fetchSourceByIdServer,
  deleteSource: deleteSourceServer,
  testConnection: testConnectionServer,
  getStatus: getStatusServer,
};

import { os } from "@orpc/server";
import { MediaService } from "~/application/services/media-service";
import { MediaSourceService } from "~/application/services/media-source-service";
import type { MediaSource } from "~/domain/repositories/source-repository";
import {
  mediaSourceInfoSchema,
  type SafeMediaSource,
} from "~/domain/sources/schemas";
import { logger } from "~/infrastructure/logger";

/**
 * 機密情報を除外した安全な MediaSource に変換
 */
function toSafeMediaSource(source: MediaSource): SafeMediaSource {
  const { connectionInfo, ...rest } = source;
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic connection info handling
  const info = connectionInfo as any;

  if (source.type === "sftp") {
    // biome-ignore lint/correctness/noUnusedVariables: Omit from safe
    const { password, privateKey, ...safe } = info;
    return { ...rest, connectionInfo: safe };
  }
  if (source.type === "s3") {
    // biome-ignore lint/correctness/noUnusedVariables: Omit from safe
    const { accessKeyId, secretAccessKey, ...safe } = info;
    return { ...rest, connectionInfo: safe };
  }
  return { ...rest, connectionInfo: info };
}

/**
 * Media Sources Router Implementation
 */
export const sourcesRouter = {
  list: os.handler(async () => {
    const sources = await MediaSourceService.fetchSources();
    return sources.map(toSafeMediaSource);
  }),

  create: os.input(mediaSourceInfoSchema).handler(async ({ input }) => {
    const result = await MediaSourceService.createSource(input);
    const createdSource = result[0];

    // ローカルソースの場合、バックグラウンド処理を開始
    if (createdSource && createdSource.type === "local") {
      MediaService.registerExistingMedia(
        createdSource.id,
        (createdSource.connectionInfo as { path: string }).path
      );

      // ファイル監視の開始
      import("~/infrastructure/jobs/file-watcher-service")
        .then((module) => {
          module.FileWatcherService.startMonitoring(createdSource.id).catch(
            (error) => {
              logger.error(
                { err: error, sourceId: createdSource.id },
                "Failed to start file watcher"
              );
            }
          );
        })
        .catch((error) => {
          logger.error(
            { err: error, sourceId: createdSource.id },
            "Failed to load file watcher service"
          );
        });
    }

    return toSafeMediaSource(createdSource);
  }),
};

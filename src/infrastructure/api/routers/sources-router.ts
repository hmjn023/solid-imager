import { os } from "@orpc/server";
import { z } from "zod";
import { BackupService } from "~/application/services/backup-service";
import { MediaService } from "~/application/services/media-service";
import { MediaSourceService } from "~/application/services/media-source-service";
import type { MediaSource } from "~/domain/repositories/source-repository";
import {
  mediaSourceInfoSchema,
  type SafeMediaSource,
} from "~/domain/sources/schemas";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
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

  get: os
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const [source] = await MediaSourceService.fetchSourceById(input.id);
      if (!source) {
        throw new Error(`Source not found: ${input.id}`);
      }
      return toSafeMediaSource(source);
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

  update: os
    .input(
      z.object({
        id: z.string().uuid(),
        data: mediaSourceInfoSchema.partial(),
      })
    )
    .handler(async ({ input }) => {
      const result = await MediaSourceService.updateSource(
        input.id,
        input.data
      );
      return toSafeMediaSource(result[0]);
    }),

  /**
   * Deletes a media source
   */
  delete: os
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      await MediaSourceService.deleteSource(input.id);

      // ファイル監視の停止
      import("~/infrastructure/jobs/file-watcher-service")
        .then((module) => {
          module.FileWatcherService.stopMonitoring(input.id).catch((error) => {
            logger.error(
              { err: error, sourceId: input.id },
              "Failed to stop file watcher"
            );
          });
        })
        .catch((error) => {
          logger.error(
            { err: error, sourceId: input.id },
            "Failed to load file watcher service"
          );
        });

      return { success: true };
    }),

  /**
   * Restores a media source from a dump
   */
  restore: os
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.array(z.any()),
      })
    )
    .handler(
      async ({ input }) =>
        await BackupService.restoreSource(input.id, input.data)
    ),

  /**
   * Imports a media source from a Zip file
   */
  importZip: os
    .input(
      z.object({
        id: z.string().uuid(),
        file: z.instanceof(File),
      })
    )
    .handler(
      async ({ input }) =>
        await BackupService.importSourceZip(input.id, input.file)
    ),

  /**
   * Real-time events stream for a media source
   */
  events: os
    .input(z.object({ id: z.string().uuid() }))
    .handler(async function* ({ input, signal }) {
      // Yield initial connection event
      yield { event: "connected", data: "connected" };

      // Queue for events
      // biome-ignore lint/suspicious/noExplicitAny: SSE payload
      const queue: { event: string; data: any }[] = [];
      let resolve: (() => void) | null = null;

      // biome-ignore lint/suspicious/noExplicitAny: SSE payload is dynamic
      const onEvent = (payload: { event: string; data: any }) => {
        queue.push(payload);
        if (resolve) {
          resolve();
          resolve = null;
        }
      };

      const eventName = `event:${input.id}`;
      SseManager.emitter.on(eventName, onEvent);

      try {
        while (!signal?.aborted) {
          if (queue.length === 0) {
            await new Promise<void>((r) => {
              resolve = r as unknown as () => void;
            });
          }

          while (queue.length > 0) {
            const item = queue.shift();
            if (item) {
              yield item;
            }
          }
        }
      } finally {
        SseManager.emitter.off(eventName, onEvent);
      }
    }),
};

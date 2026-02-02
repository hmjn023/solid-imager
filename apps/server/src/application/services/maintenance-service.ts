import fs from "node:fs/promises";
import path from "node:path";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { getSourceCacheDir } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

export class MaintenanceService {
  constructor(
    private readonly mediaRepo: IMediaRepository,
    private readonly jobRepo: IJobRepository,
    private readonly sourceRepo: SourceRepository
  ) {}

  /**
   * Performs startup checks to ensure data consistency and recovery.
   */
  async performStartupChecks(): Promise<void> {
    logger.info("Starting startup checks...");
    try {
      await this.queueMissingMetadata();
      await this.queueMissingThumbnails();
      logger.info("Startup checks completed.");
    } catch (err) {
      logger.error({ err }, "Startup checks failed");
    }
  }

  private async queueMissingMetadata() {
    try {
      const missing = await this.mediaRepo.findIdsWithMissingGenerationInfo();
      if (missing.length === 0) {
        return;
      }

      logger.info(
        { count: missing.length },
        "Found media with missing metadata. Queueing jobs..."
      );
      // If metadata is missing, we prioritize fetching it.
      // We skip thumbnail generation here to avoid redundant work, assuming queueMissingThumbnails handles that.
      await this.dispatchJobs(missing, { skipThumbnailGeneration: true });
    } catch (error) {
      logger.error({ err: error }, "Failed to queue missing metadata jobs");
    }
  }

  private async queueMissingThumbnails() {
    try {
      const allMedia = await this.mediaRepo.findAllMediaIndices();
      const missing: typeof allMedia = [];

      // Group by mediaSourceId to optimize readdir
      const mediaBySource = new Map<string, typeof allMedia>();
      for (const media of allMedia) {
        if (!mediaBySource.has(media.mediaSourceId)) {
          mediaBySource.set(media.mediaSourceId, []);
        }
        mediaBySource.get(media.mediaSourceId)?.push(media);
      }

      for (const [sourceId, items] of mediaBySource) {
        const cacheDir = getSourceCacheDir(sourceId);
        let existingFiles: Set<string>;

        try {
          const files = await fs.readdir(cacheDir);
          // Files are named "{id}.webp". We extract the ID (basename without ext).
          existingFiles = new Set(
            files.map((f) => path.basename(f, path.extname(f)))
          );
        } catch (error) {
          // If directory doesn't exist (ENOENT), all thumbnails are missing
          if ((error as { code?: string }).code === "ENOENT") {
            existingFiles = new Set();
          } else {
            logger.warn(
              { err: error, sourceId },
              "Failed to read thumbnail directory"
            );
            continue; // Skip this source on unexpected error
          }
        }

        for (const item of items) {
          if (!existingFiles.has(item.id)) {
            missing.push(item);
          }
        }
      }

      if (missing.length === 0) {
        return;
      }

      logger.info(
        { count: missing.length },
        "Found media with missing thumbnails. Queueing jobs..."
      );

      // We only need thumbnails here.
      await this.dispatchJobs(missing, { skipMetadataExtraction: true });
    } catch (error) {
      logger.error({ err: error }, "Failed to queue missing thumbnail jobs");
    }
  }

  private async dispatchJobs(
    items: { id: string; mediaSourceId: string; filePath: string }[],
    options: {
      skipMetadataExtraction?: boolean;
      skipThumbnailGeneration?: boolean;
    }
  ) {
    // Resolve source paths efficiently
    const sourceIds = [...new Set(items.map((i) => i.mediaSourceId))];
    const sources = new Map<string, string>(); // id -> path

    for (const sid of sourceIds) {
      const source = await this.sourceRepo.findById(sid);
      if (source && source.type === "local") {
        const info = source.connectionInfo;
        if (
          info &&
          typeof info === "object" &&
          "path" in info &&
          typeof (info as { path: string }).path === "string"
        ) {
          sources.set(sid, (info as { path: string }).path);
        } else {
          logger.warn({ sourceId: sid }, "Invalid local source config");
        }
      }
    }

    let queuedCount = 0;
    for (const item of items) {
      const basePath = sources.get(item.mediaSourceId);
      if (!basePath) {
        continue; // Skip non-local or missing sources
      }

      const created = await this.jobRepo.createIfUnique({
        type: "processMedia",
        mediaSourceId: item.mediaSourceId,
        payload: {
          mediaId: item.id,
          sourcePath: basePath,
          type: "processMedia", // Legacy payload requirement
          ...options,
        },
      });

      if (created) {
        queuedCount++;
      }
    }

    if (queuedCount > 0) {
      logger.info({ count: queuedCount }, "Dispatched recovery jobs");
    }
  }
}

import fs from "node:fs/promises";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";
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

      // Process in chunks to avoid overwhelming the event loop or file system
      const chunkSize = 50;
      for (let i = 0; i < allMedia.length; i += chunkSize) {
        const chunk = allMedia.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (m) => {
            const thumbPath = getThumbnailPath(m.mediaSourceId, m.id);
            try {
              await fs.access(thumbPath);
            } catch {
              missing.push(m);
            }
          })
        );
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
        sources.set(sid, (source.connectionInfo as { path: string }).path);
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

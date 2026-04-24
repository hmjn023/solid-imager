import fs from "node:fs/promises";
import path from "node:path";
import { MaintenanceService as SharedMaintenanceService } from "@solid-imager/application/services/maintenance-service";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { getSourceCacheDir } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

export class MaintenanceService extends SharedMaintenanceService {
	constructor(
		mediaRepository: IMediaRepository,
		jobRepository: IJobRepository,
		sourceRepository: SourceRepository,
	) {
		super({
			mediaRepository,
			jobRepository,
			sourceRepository,
			logger,
			listExistingThumbnailIds: async (sourceId: string) => {
				const cacheDir = getSourceCacheDir(sourceId);
				try {
					const files = await fs.readdir(cacheDir);
					return new Set(
						files.map((file) => path.basename(file, path.extname(file))),
					);
				} catch (error) {
					if ((error as { code?: string }).code === "ENOENT") {
						return new Set<string>();
					}
					logger.warn(
						{ err: error, sourceId },
						"Failed to read thumbnail directory",
					);
					return null;
				}
			},
		});
	}
}

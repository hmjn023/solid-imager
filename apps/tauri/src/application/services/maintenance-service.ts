import { MaintenanceService as SharedMaintenanceService } from "@solid-imager/application/services/maintenance-service";
import { appDataDir, isAbsolute, join } from "@tauri-apps/api/path";
import { getTauriAppServices } from "~/app-services";
import { TauriMediaRepository } from "~/infrastructure/local-api/repositories/media-repository";
import { TauriSourceRepository } from "~/infrastructure/local-api/repositories/source-repository";
import { TauriJobRepository } from "~/infrastructure/local-api/repositories/tauri-job-repository";
import { TauriConfigService } from "~/infrastructure/local-api/services/config-service";

export class MaintenanceService {
	private readonly shared: SharedMaintenanceService;

	constructor(
		options: {
			afterJobsQueued?: (sourceIds: string[]) => Promise<void> | void;
		} = {},
	) {
		this.shared = new SharedMaintenanceService({
			mediaRepository: TauriMediaRepository,
			jobRepository: TauriJobRepository,
			sourceRepository: TauriSourceRepository,
			logger: console,
			afterJobsQueued: options.afterJobsQueued,
			listExistingThumbnailIds: async (sourceId: string) => {
				const config = await TauriConfigService.getConfig();
				const fs = getTauriAppServices().fileSystem;
				const sourceCacheDir = await resolveSourceCacheDir(
					config.storage.thumbnailDir,
					sourceId,
				);

				try {
					if (!(await fs.exists(sourceCacheDir))) {
						return new Set<string>();
					}
					const files = await fs.readdir(sourceCacheDir);
					return new Set(files.map((file) => file.replace(/\.[^/.]+$/, "")));
				} catch (error) {
					console.warn(
						`[maintenance] Failed to read thumbnail directory for source ${sourceId}`,
						error,
					);
					return null;
				}
			},
		});
	}

	async performStartupChecks(): Promise<void> {
		await this.shared.performStartupChecks();
	}
}

async function resolveSourceCacheDir(
	thumbnailDir: string,
	sourceId: string,
): Promise<string> {
	let basePath = thumbnailDir;
	if (!(await isAbsolute(thumbnailDir))) {
		basePath = await join(await appDataDir(), thumbnailDir);
	}
	return await join(basePath, sourceId);
}

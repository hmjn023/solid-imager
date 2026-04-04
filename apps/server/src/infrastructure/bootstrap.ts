import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import { services } from "~/application/registry";
import { CharacterServiceImpl } from "~/application/services/character-service";
import { processJob } from "~/application/services/job-dispatch-service";
import { MaintenanceService } from "~/application/services/maintenance-service";
import { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";
import { ServerConfigService } from "~/application/services/server-config-service";
import { PythonClient } from "~/infrastructure/ai/python-client";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { UnsupportedDownloadBackend } from "~/infrastructure/downloads/unsupported-download-backend";
import { YtDlpDownloadBackend } from "~/infrastructure/downloads/yt-dlp-download-backend";
import { NodeFileSystem } from "~/infrastructure/file-system/node-file-system";
import { updateDownloadRateLimitConfig } from "~/infrastructure/jobs/download-rate-limiter";
import { JobWorker } from "~/infrastructure/jobs/job-worker";
import { logger, updateLogLevel } from "~/infrastructure/logger";
import * as processingModule from "~/infrastructure/processing/image-processor";
import { createImageProcessorFacade } from "~/infrastructure/processing/image-processor-facade";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { JobRepository } from "~/infrastructure/repositories/job-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";
import { DrizzleSourceRepository as ActualSourceRepo } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

export let isBootstrapped = false;
export let isWorkerStarted = false;

function isTauriBuild(): boolean {
	return typeof __TAURI_BUILD__ !== "undefined" && __TAURI_BUILD__;
}

const registeredMetadataExtractor =
	"metadataExtractor" in processingModule
		? processingModule.metadataExtractor
		: {
				extract: (mediaPath: string) =>
					processingModule.ImageProcessor.extractMetadata(mediaPath),
			};

const registeredThumbnailGenerator =
	"thumbnailGenerator" in processingModule
		? processingModule.thumbnailGenerator
		: {
				generate: (
					mediaPath: string,
					outputPath: string,
					size: number,
					quality: number,
				) =>
					processingModule.ImageProcessor.generateThumbnail(
						mediaPath,
						outputPath,
						size,
						quality,
					),
			};

const registeredMediaProbe =
	"mediaProbe" in processingModule
		? processingModule.mediaProbe
		: {
				getDimensions: (mediaPath: string) => {
					const legacyImageProcessor = (
						processingModule as {
							ImageProcessor?: {
								getDimensions(mediaPath: string): Promise<{
									width: number;
									height: number;
								}>;
							};
						}
					).ImageProcessor;
					if (!legacyImageProcessor) {
						return Promise.resolve({ width: 0, height: 0 });
					}
					return legacyImageProcessor.getDimensions(mediaPath);
				},
				async probe(mediaPath: string) {
					const stats = await import("node:fs/promises").then((module) =>
						module.default.stat(mediaPath),
					);
					const legacyImageProcessor = (
						processingModule as {
							ImageProcessor?: {
								getDimensions(mediaPath: string): Promise<{
									width: number;
									height: number;
								}>;
							};
						}
					).ImageProcessor;
					const dimensions = legacyImageProcessor
						? await legacyImageProcessor
								.getDimensions(mediaPath)
								.catch(() => ({ width: 0, height: 0 }))
						: { width: 0, height: 0 };
					return {
						width: dimensions.width,
						height: dimensions.height,
						size: stats.size,
						createdAt: stats.birthtime,
						modifiedAt: stats.mtime,
					};
				},
			};

const registeredImageProcessor: IImageProcessor = createImageProcessorFacade({
	metadataExtractor: registeredMetadataExtractor,
	thumbnailGenerator: registeredThumbnailGenerator,
	mediaProbe: registeredMediaProbe,
});

/**
 * Initializes all services and repositories.
 * This should be called early in the server-side lifecycle (including SSR).
 */
export function initServices() {
	if (isBootstrapped) {
		return;
	}
	isBootstrapped = true;

	// Initialize and load configuration
	const configService = new ServerConfigService();
	configService.load();
	services.registerConfigService(configService);

	const config = configService.getConfig();

	// Initialize log level from config and subscribe to changes
	updateLogLevel(config.logging.level);
	updateDownloadRateLimitConfig(config.downloads);
	configService.onChange((newConfig) => {
		updateLogLevel(newConfig.logging.level);
		updateDownloadRateLimitConfig(newConfig.downloads);
	});

	// Register Repositories
	services.registerMediaRepository(MediaRepository);
	services.registerSourceRepository(new ActualSourceRepo());
	services.registerTagRepository(TagRepository);
	services.registerAuthorRepository(AuthorRepository);
	services.registerProjectRepository(ProjectRepository);
	services.registerCharacterRepository(new DrizzleCharacterRepository());
	services.registerIpRepository(IpRepository);

	const jobRepo = new JobRepository();
	services.registerJobRepository(jobRepo);

	// Register Services
	services.registerFileSystem(new NodeFileSystem());
	services.registerMetadataExtractor(registeredMetadataExtractor);
	services.registerThumbnailGenerator(registeredThumbnailGenerator);
	services.registerMediaProbe(registeredMediaProbe);
	services.registerImageProcessor(registeredImageProcessor);
	services.registerMediaStorage(ServerMediaStorage);
	services.registerDownloadBackend(
		isTauriBuild()
			? new UnsupportedDownloadBackend(
					"Tauri runtime download backend is not wired yet.",
				)
			: new YtDlpDownloadBackend(),
	);

	// Initialize PythonClient with config values
	const pythonClient = new PythonClient(config.ai.baseUrl, config.ai.timeoutMs);
	services.registerAiClient(pythonClient);
	configService.onChange((newConfig) =>
		pythonClient.updateConfig(newConfig.ai),
	);

	const jobWorker = new JobWorker(jobRepo, processJob);
	// Initialize worker with current config and subscribe to changes
	jobWorker.updateConfig(configService.getConfig());
	configService.onChange((newConfig) => jobWorker.updateConfig(newConfig));

	services.registerJobWorker(jobWorker);

	services.registerCharacterService(
		new CharacterServiceImpl(
			services.getCharacterRepository(),
			services.getIpRepository(),
			DrizzleTransactionManager,
		),
	);

	// Register MediaProcessingService (Implementation)
	services.registerMediaProcessingService(
		new MediaProcessingServiceImpl(
			services.getSourceRepository(),
			services.getMediaRepository(),
			services.getTagRepository(),
			services.getAuthorRepository(),
			services.getCharacterService(),
			services.getIpRepository(),
			services.getProjectRepository(),
			jobRepo,
			configService,
		),
	);
}

/**
 * Starts background worker and maintenance tasks.
 * This should only be called once in the main server process, never during SSR request processing.
 */
export function startBackgroundWorker() {
	if (isWorkerStarted) {
		return;
	}
	isWorkerStarted = true;

	initServices(); // Ensure services are initialized

	const jobWorker = services.getJobWorker();
	const jobRepo = services.getJobRepository();

	// Singleton management for JobWorker to prevent duplicates during HMR
	const globalAny = globalThis as any;
	if (globalAny.__JOB_WORKER__) {
		globalAny.__JOB_WORKER__.stop();
	}

	globalAny.__JOB_WORKER__ = jobWorker;
	jobWorker.start();

	// Initialize MaintenanceService and perform startup checks (background)
	const maintenanceService = new MaintenanceService(
		services.getMediaRepository(),
		jobRepo,
		services.getSourceRepository(),
	);

	maintenanceService.performStartupChecks().catch((err) => {
		logger.error({ err }, "Maintenance startup checks failed");
	});

	// Cleanup on process exit
	if (!globalAny.__BOOTSTRAP_CLEANUP_REGISTERED__) {
		const cleanup = () => {
			if (globalAny.__JOB_WORKER__) {
				globalAny.__JOB_WORKER__.stop();
			}
		};

		process.on("SIGINT", () => {
			cleanup();
			process.exit(0);
		});

		process.on("SIGTERM", () => {
			cleanup();
			process.exit(0);
		});

		globalAny.__BOOTSTRAP_CLEANUP_REGISTERED__ = true;
	}
}

/**
 * Main bootstrap function for backward compatibility.
 * In TanStack Start SSR, avoid calling this and call initServices instead.
 */
export function bootstrap() {
	initServices();
	startBackgroundWorker();
}

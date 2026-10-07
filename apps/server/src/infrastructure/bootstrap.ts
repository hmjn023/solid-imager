import { processingSettingsFromConfig } from "@solid-imager/core/domain/processing/schemas";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { NodeFileSystem } from "~/infrastructure/file-system/node-file-system";
import { updateDownloadRateLimitConfig } from "~/infrastructure/jobs/download-rate-limiter";
import { MediaFileWorker } from "~/infrastructure/jobs/media-file-worker";
import { JobWorker } from "~/infrastructure/jobs/job-worker";
import {
	deleteThumbnail,
	thumbnailExists,
	prepareProcessingThumbnail,
	processThumbnailGenerationJob,
} from "~/infrastructure/jobs/thumbnails";
import { logger, updateLogLevel } from "~/infrastructure/logger";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { JobRepository } from "~/infrastructure/repositories/job-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";
import { DrizzleSourceRepository as ActualSourceRepo } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { services } from "~/infrastructure/service-registry";
import { configureCcipVectorService } from "~/infrastructure/services/ccip-vector-service";
import { CharacterServiceImpl } from "~/infrastructure/services/character-service";
import {
	configureThumbnailJobHandlers,
	processJob,
} from "~/infrastructure/services/job-dispatch-service";
import { MaintenanceService } from "~/infrastructure/services/maintenance-service";
import { MediaProcessingServiceImpl } from "~/infrastructure/services/media-processing-service";
import { ServerConfigService } from "~/infrastructure/services/server-config-service";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

export let isBootstrapped = false;
export let isWorkerStarted = false;

/**
 * Initializes all services and repositories.
 * This should be called early in the server-side lifecycle (including SSR).
 */
export function initServices() {
	if (isBootstrapped) {
		return;
	}
	logger.info("[Bootstrap] Initializing server services...");
	configureCcipVectorService(logger);
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
	services.registerSourceRepository(ActualSourceRepo);
	services.registerTagRepository(TagRepository);
	services.registerAuthorRepository(AuthorRepository);
	services.registerProjectRepository(ProjectRepository);
	services.registerCharacterRepository(DrizzleCharacterRepository);
	services.registerIpRepository(IpRepository);

	const jobRepo = JobRepository;
	services.registerJobRepository(jobRepo);
	configureThumbnailJobHandlers({
		deleteThumbnail,
		processThumbnailGenerationJob,
	});

	// Register Services
	services.registerMediaStorage(ServerMediaStorage);
	services.registerFileSystem(new NodeFileSystem());
	services.registerImageProcessor(ImageProcessor);

	// Initialize RustAiClient with config values
	const rustAiClient = new RustAiClient(config.ai);
	services.registerAiClient(rustAiClient);
	configService.onChange((newConfig) =>
		rustAiClient.updateConfig(newConfig.ai),
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
	const mediaProcessingService = new MediaProcessingServiceImpl({
		processingStateRepo: MediaProcessingStateRepository,
		getProcessingSettings: () =>
			processingSettingsFromConfig(configService.getConfig()),
		hasThumbnails: async (sourceId, mediaId) =>
			(
				await Promise.all([
					thumbnailExists(sourceId, mediaId, 512),
					thumbnailExists(sourceId, mediaId, 256),
				])
			).every(Boolean),
		transactionManager: DrizzleTransactionManager,
		sourceRepo: services.getSourceRepository(),
		mediaRepo: services.getMediaRepository(),
		tagRepo: services.getTagRepository(),
		authorRepo: services.getAuthorRepository(),
		characterRepo: services.getCharacterRepository(),
		ipRepo: services.getIpRepository(),
		projectRepo: services.getProjectRepository(),
		jobRepo,
		imageProcessor: services.getImageProcessor(),
		mediaStorage: services.getMediaStorage(),
		logger,
		enableAutoTagging: config.jobs.enableAutoTagging,
		enableAutoCcipExtraction: config.jobs.enableAutoCcipExtraction,
		supportedExtensions: config.media.supportedExtensions,
		prepareThumbnail: prepareProcessingThumbnail,
		publishJobProgress: (jobId, processed, total) =>
			RealtimeEventBus.publishJob("job-progress", { jobId, processed, total }),
		publishSourceEvent: (mediaSourceId, event, data) =>
			RealtimeEventBus.publishSource(mediaSourceId, event, data),
	});
	services.registerMediaProcessingService(mediaProcessingService);
	const fileWorker = new MediaFileWorker(mediaProcessingService);
	fileWorker.updateConfig(config);
	configService.onChange((newConfig) => fileWorker.updateConfig(newConfig));
	services.registerMediaFileWorker(fileWorker);
	configService.onChange((newConfig) =>
		mediaProcessingService.updateConfig({
			enableAutoTagging: newConfig.jobs.enableAutoTagging,
			enableAutoCcipExtraction: newConfig.jobs.enableAutoCcipExtraction,
		}),
	);
}

/**
 * Starts background worker and maintenance tasks.
 * This should only be called once in the main server process, never during SSR request processing.
 */
type WorkerGlobal = typeof globalThis & {
	__JOB_WORKER__?: JobWorker;
	__MEDIA_FILE_WORKER__?: MediaFileWorker;
	__WORKER_STARTUP__?: Promise<void>;
	__BOOTSTRAP_CLEANUP_REGISTERED__?: boolean;
};
export function startBackgroundWorker(): Promise<void> {
	const host = globalThis as WorkerGlobal;
	if (isWorkerStarted) return host.__WORKER_STARTUP__ ?? Promise.resolve();
	isWorkerStarted = true;
	initServices();
	const jobWorker = services.getJobWorker();
	const fileWorker = services.getMediaFileWorker();
	const previousStart = host.__WORKER_STARTUP__;
	const startup = async () => {
		await previousStart?.catch(() => undefined);
		host.__JOB_WORKER__?.stop();
		await host.__MEDIA_FILE_WORKER__?.stop();
		// Deployments must stop old-version writers before starting this version.
		await services.getMediaProcessingService().reconcileFileTasks();
		host.__JOB_WORKER__ = jobWorker;
		host.__MEDIA_FILE_WORKER__ = fileWorker;
		fileWorker.start();
		jobWorker.start();
		const maintenance = new MaintenanceService(
			services.getMediaRepository(),
			services.getMediaProcessingService(),
			services.getSourceRepository(),
		);
		void maintenance
			.performStartupChecks()
			.catch((err) =>
				logger.error({ err }, "Maintenance startup checks failed"),
			);
	};
	host.__WORKER_STARTUP__ = startup().catch((err) => {
		isWorkerStarted = false;
		logger.error({ err }, "Background worker startup failed");
		throw err;
	});
	if (!host.__BOOTSTRAP_CLEANUP_REGISTERED__) {
		const cleanup = async () => {
			await host.__WORKER_STARTUP__?.catch(() => undefined);
			host.__JOB_WORKER__?.stop();
			await host.__MEDIA_FILE_WORKER__?.stop();
			process.exit(0);
		};
		process.on("SIGINT", () => {
			void cleanup();
		});
		process.on("SIGTERM", () => {
			void cleanup();
		});
		host.__BOOTSTRAP_CLEANUP_REGISTERED__ = true;
	}
	return host.__WORKER_STARTUP__;
}

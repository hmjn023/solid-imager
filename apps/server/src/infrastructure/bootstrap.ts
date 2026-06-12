import { services } from "~/application/registry";
import { CharacterServiceImpl } from "~/application/services/character-service";
import { processJob } from "~/application/services/job-dispatch-service";
import { MaintenanceService } from "~/application/services/maintenance-service";
import { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";
import { ServerConfigService } from "~/application/services/server-config-service";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { NodeFileSystem } from "~/infrastructure/file-system/node-file-system";
import { updateDownloadRateLimitConfig } from "~/infrastructure/jobs/download-rate-limiter";
import { JobWorker } from "~/infrastructure/jobs/job-worker";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { generateThumbnail } from "~/infrastructure/jobs/thumbnails";
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

	// Register Services
	services.registerMediaStorage(ServerMediaStorage);
	services.registerFileSystem(new NodeFileSystem());
	services.registerImageProcessor(ImageProcessor);

	// Initialize RustAiClient with config values
	const rustAiClient = new RustAiClient(config.ai.baseUrl, config.ai.timeoutMs);
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
		enableAutoTagging: config.jobs.enableAutoTagging,
		supportedExtensions: config.media.supportedExtensions,
		generateThumbnail: (
			media: { id: string; filePath: string },
			sourcePath: string,
			mediaSourceId: string,
		) => generateThumbnail(media, sourcePath, mediaSourceId),
		sseSendEvent: (mediaSourceId: string, event: string, data: unknown) =>
			SseManager.sendEvent(mediaSourceId, event, data),
	});
	services.registerMediaProcessingService(mediaProcessingService);
	configService.onChange((newConfig) =>
		mediaProcessingService.updateConfig({
			enableAutoTagging: newConfig.jobs.enableAutoTagging,
		}),
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
	const globalAny = globalThis as typeof globalThis & {
		__JOB_WORKER__?: JobWorker;
		__BOOTSTRAP_CLEANUP_REGISTERED__?: boolean;
	};
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

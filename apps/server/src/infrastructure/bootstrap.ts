import { BackgroundJobsCoordinator } from "@solid-imager/application/services/background-jobs-coordinator";
import { services } from "~/application/registry";
import { CharacterServiceImpl } from "~/application/services/character-service";
import { processJob } from "~/application/services/job-dispatch-service";
import { MaintenanceService } from "~/application/services/maintenance-service";
import { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";
import {
	loadServerConfig,
	serverConfigService,
} from "~/application/services/server-config-service";
import { PythonClient } from "~/infrastructure/ai/python-client";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { NodeFileSystem } from "~/infrastructure/file-system/node-file-system";
import { updateDownloadRateLimitConfig } from "~/infrastructure/jobs/download-rate-limiter";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { JobWorker } from "~/infrastructure/jobs/job-worker";
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
 * Also used in tests to bootstrap services without starting background workers.
 */
export function initServices() {
	if (isBootstrapped) {
		return;
	}
	isBootstrapped = true;

	// Initialize and load configuration
	loadServerConfig();
	services.registerConfigService(serverConfigService);

	const config = serverConfigService.getConfig();

	// Initialize log level from config and subscribe to changes
	updateLogLevel(config.logging.level);
	updateDownloadRateLimitConfig(config.downloads);
	serverConfigService.onChange((newConfig) => {
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
	services.registerMediaStorage(ServerMediaStorage);
	services.registerFileSystem(new NodeFileSystem());
	services.registerImageProcessor(ImageProcessor);

	// Initialize PythonClient with config values
	const pythonClient = new PythonClient(config.ai.baseUrl, config.ai.timeoutMs);
	services.registerAiClient(pythonClient);
	serverConfigService.onChange((newConfig) =>
		pythonClient.updateConfig(newConfig.ai),
	);

	const jobWorker = new JobWorker({
		jobRepository: jobRepo,
		processor: processJob,
		logger,
	});
	// Initialize worker with current config and subscribe to changes
	jobWorker.updateConfig(serverConfigService.getConfig());
	serverConfigService.onChange((newConfig) =>
		jobWorker.updateConfig(newConfig),
	);

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
			serverConfigService,
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
	const configService = serverConfigService;

	// Singleton management for JobWorker to prevent duplicates during HMR
	const globalAny = globalThis as any;
	if (globalAny.__JOB_WORKER__) {
		globalAny.__JOB_WORKER__.stop();
	}

	globalAny.__JOB_WORKER__ = jobWorker;
	const coordinator = new BackgroundJobsCoordinator({
		loadConfig: () => configService.getConfig(),
		onConfigChange: (listener) => {
			configService.onChange((nextConfig) => {
				void listener(nextConfig);
			});
		},
		updateWorkerConfig: (config) => {
			jobWorker.updateConfig(config);
		},
		resetRunnableJobs: async () => {
			await jobRepo.resetInProgressToPending();
		},
		startWorker: () => {
			jobWorker.start();
		},
		startWatchingAllSources: async () => {
			await FileWatcherService.startMonitoringAll();
		},
		performStartupChecks: async ({ afterJobsQueued }) => {
			const maintenanceService = new MaintenanceService(
				services.getMediaRepository(),
				jobRepo,
				services.getSourceRepository(),
				{
					afterJobsQueued,
				},
			);
			await maintenanceService.performStartupChecks();
		},
		logger,
	});

	void coordinator.start().catch((err) => {
		logger.error({ err }, "Background coordinator startup failed");
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

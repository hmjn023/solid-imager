import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";

type BackgroundJobsCoordinatorLogger = {
	info?(data: unknown, message?: string): void;
	error?(data: unknown, message?: string): void;
};

type BackgroundJobsCoordinatorHooks = {
	afterJobsQueued: (sourceIds: string[]) => Promise<void>;
};

type BackgroundJobsCoordinatorOptions = {
	loadConfig: () => Promise<AppConfig> | AppConfig;
	onConfigChange: (
		listener: (config: AppConfig) => Promise<void> | void,
	) => Promise<void> | void;
	updateWorkerConfig: (config: AppConfig) => Promise<void> | void;
	resetRunnableJobs: () => Promise<void>;
	startWorker: () => Promise<void> | void;
	startWatchingAllSources: () => Promise<void>;
	performStartupChecks: (
		hooks: BackgroundJobsCoordinatorHooks,
	) => Promise<void>;
	afterJobsQueued?: (sourceIds: string[]) => Promise<void> | void;
	logger?: BackgroundJobsCoordinatorLogger;
};

export class BackgroundJobsCoordinator {
	private readonly loadConfig: BackgroundJobsCoordinatorOptions["loadConfig"];
	private readonly onConfigChange: BackgroundJobsCoordinatorOptions["onConfigChange"];
	private readonly updateWorkerConfig: BackgroundJobsCoordinatorOptions["updateWorkerConfig"];
	private readonly resetRunnableJobs: BackgroundJobsCoordinatorOptions["resetRunnableJobs"];
	private readonly startWorker: BackgroundJobsCoordinatorOptions["startWorker"];
	private readonly startWatchingAllSources: BackgroundJobsCoordinatorOptions["startWatchingAllSources"];
	private readonly performStartupChecks: BackgroundJobsCoordinatorOptions["performStartupChecks"];
	private readonly afterJobsQueued:
		| ((sourceIds: string[]) => Promise<void> | void)
		| undefined;
	private readonly logger: BackgroundJobsCoordinatorLogger | undefined;

	constructor(options: BackgroundJobsCoordinatorOptions) {
		this.loadConfig = options.loadConfig;
		this.onConfigChange = options.onConfigChange;
		this.updateWorkerConfig = options.updateWorkerConfig;
		this.resetRunnableJobs = options.resetRunnableJobs;
		this.startWorker = options.startWorker;
		this.startWatchingAllSources = options.startWatchingAllSources;
		this.performStartupChecks = options.performStartupChecks;
		this.afterJobsQueued = options.afterJobsQueued;
		this.logger = options.logger;
	}

	async start(): Promise<void> {
		const config = await this.loadConfig();
		await this.updateWorkerConfig(config);
		await this.onConfigChange(async (nextConfig) => {
			await this.updateWorkerConfig(nextConfig);
		});
		await this.resetRunnableJobs();
		await this.startWorker();
		await this.startWatchingAllSources();
		await this.performStartupChecks({
			afterJobsQueued: async (sourceIds) => {
				await this.afterJobsQueued?.(sourceIds);
			},
		});
		this.logger?.info?.("Background jobs coordinator started");
	}
}

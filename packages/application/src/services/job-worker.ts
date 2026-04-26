import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import type {
	FindPendingJobsOptions,
	JobRecord,
	JobRepositoryPort,
} from "../ports/job-repository";
import { AI_JOB_TYPES, NON_RUNNABLE_JOB_TYPES } from "./job-runtime";

export type JobProcessor = (job: JobRecord) => Promise<void>;

export type JobWorkerConfig = {
	concurrency: number;
	aiConcurrency: number;
	pollIntervalMs: number;
};

export type JobWorkerLogger = {
	info?(data: unknown, message?: string): void;
	error?(data: unknown, message?: string): void;
};

type JobWorkerOptions = {
	jobRepository: JobRepositoryPort;
	processor: JobProcessor;
	logger?: JobWorkerLogger;
	aiJobTypes?: string[];
	excludedJobTypes?: string[];
};

function toWorkerConfig(config: AppConfig | JobWorkerConfig): JobWorkerConfig {
	if ("jobs" in config) {
		return {
			concurrency: config.jobs.concurrency,
			aiConcurrency: config.jobs.aiConcurrency,
			pollIntervalMs: config.jobs.pollIntervalMs,
		};
	}
	return config;
}

function mergeExcludeTypes(
	options: FindPendingJobsOptions,
	excludedJobTypes: string[],
): FindPendingJobsOptions {
	const excludeTypes = [
		...(options.excludeTypes ?? []),
		...excludedJobTypes,
	].filter((value, index, values) => values.indexOf(value) === index);
	return { ...options, excludeTypes };
}

export class JobWorker {
	private isRunning = false;
	private timeoutId: ReturnType<typeof setTimeout> | null = null;
	private pollPromise: Promise<void> | null = null;
	private pollRequested = false;
	private pollIntervalMs = 1000;
	private concurrency = 3;
	private aiConcurrency = 1;
	private activeJobs = 0;
	private activeAiJobs = 0;

	private readonly jobRepository: JobRepositoryPort;
	private readonly processor: JobProcessor;
	private readonly logger: JobWorkerLogger | undefined;
	private readonly aiJobTypes: Set<string>;
	private readonly excludedJobTypes: string[];

	constructor(options: JobWorkerOptions) {
		this.jobRepository = options.jobRepository;
		this.processor = options.processor;
		this.logger = options.logger;
		this.aiJobTypes = new Set(options.aiJobTypes ?? AI_JOB_TYPES);
		this.excludedJobTypes = options.excludedJobTypes ?? [
			...NON_RUNNABLE_JOB_TYPES,
		];
	}

	start(): void {
		if (this.isRunning) {
			return;
		}
		this.isRunning = true;
		this.logger?.info?.("Job processing worker started");
		this.wake();
	}

	stop(): void {
		this.isRunning = false;
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		this.logger?.info?.("Job processing worker stopped");
	}

	updateConfig(config: AppConfig | JobWorkerConfig): void {
		const nextConfig = toWorkerConfig(config);
		const oldConcurrency = this.concurrency;
		const oldAiConcurrency = this.aiConcurrency;
		const oldPollInterval = this.pollIntervalMs;

		this.concurrency = nextConfig.concurrency;
		this.aiConcurrency = nextConfig.aiConcurrency;
		this.pollIntervalMs = nextConfig.pollIntervalMs;

		if (
			(oldConcurrency !== this.concurrency ||
				oldAiConcurrency !== this.aiConcurrency ||
				oldPollInterval !== this.pollIntervalMs) &&
			this.isRunning
		) {
			this.logger?.info?.(
				{
					concurrency: this.concurrency,
					aiConcurrency: this.aiConcurrency,
					pollIntervalMs: this.pollIntervalMs,
				},
				"JobWorker config updated",
			);
			this.wake();
		}
	}

	wake(): void {
		if (!this.isRunning) {
			return;
		}
		this.pollRequested = true;
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		if (!this.pollPromise) {
			this.pollPromise = this.poll().finally(() => {
				this.pollPromise = null;
			});
		}
	}

	private scheduleNextPoll(): void {
		if (!this.isRunning || this.timeoutId) {
			return;
		}
		this.timeoutId = setTimeout(() => {
			this.timeoutId = null;
			this.wake();
		}, this.pollIntervalMs);
	}

	private async poll(): Promise<void> {
		if (!this.isRunning) {
			return;
		}

		while (this.isRunning && this.pollRequested) {
			this.pollRequested = false;
			try {
				await this.pollAiJobs();
				await this.pollNormalJobs();
			} catch (error) {
				this.logger?.error?.({ err: error }, "Error polling for jobs");
			}
		}

		this.scheduleNextPoll();
	}

	private async pollAiJobs(): Promise<void> {
		if (this.activeAiJobs >= this.aiConcurrency) {
			return;
		}

		const slots = this.aiConcurrency - this.activeAiJobs;
		const jobs = await this.jobRepository.findPending(slots, {
			includeTypes: Array.from(this.aiJobTypes),
		});
		for (const job of jobs) {
			this.processJob(job);
		}
	}

	private async pollNormalJobs(): Promise<void> {
		const activeNormalJobs = this.activeJobs - this.activeAiJobs;
		if (activeNormalJobs >= this.concurrency) {
			return;
		}

		const slots = this.concurrency - activeNormalJobs;
		const options = mergeExcludeTypes(
			{ excludeTypes: Array.from(this.aiJobTypes) },
			this.excludedJobTypes,
		);
		const jobs = await this.jobRepository.findPending(slots, options);
		for (const job of jobs) {
			this.processJob(job);
		}
	}

	private processJob(job: JobRecord): void {
		this.activeJobs++;
		const isAiJob = this.aiJobTypes.has(job.type);
		if (isAiJob) {
			this.activeAiJobs++;
		}

		void this.runJob(job, isAiJob);
	}

	private async runJob(job: JobRecord, isAiJob: boolean): Promise<void> {
		try {
			await this.jobRepository.markAsInProgress(job.id);
			await this.processor(job);
			await this.jobRepository.markAsCompleted(job.id, { success: true });
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.logger?.error?.({ err: error, jobId: job.id }, "Job failed");
			await this.jobRepository.markAsFailed(job.id, errorMessage);
		} finally {
			this.activeJobs--;
			if (isAiJob) {
				this.activeAiJobs--;
			}
			this.wake();
		}
	}
}

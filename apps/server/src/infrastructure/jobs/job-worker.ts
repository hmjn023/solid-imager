import type { SourceWorker } from "./source-worker";
import { setImmediate as yieldPoll } from "node:timers/promises";
import type { SourceRunClaim } from "@solid-imager/core/domain/source-runs/schemas";
import { retiredSourceJobTypes } from "@solid-imager/core/domain/source-runs/schemas";
import type { BatchWorker } from "./batch-worker";
import type { BatchClaim } from "@solid-imager/core/domain/batches/schemas";
import { retiredBatchJobTypes } from "@solid-imager/core/domain/batches/schemas";
import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { isBatchParentJobType } from "@solid-imager/core/domain/jobs/schemas";
import type { JobEvent } from "@solid-imager/core/domain/sources/events";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { Job } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import type { DownloadWorker } from "./download-worker";
import type { DownloadClaim } from "@solid-imager/core/domain/downloads/schemas";
import {
	cleanupExpiredJobTransferFiles,
	cleanupOrphanedJobTransferFiles,
	removeJobTransferFile,
} from "~/infrastructure/services/job-transfer-storage";

type JsonSafeValue =
	| string
	| number
	| boolean
	| null
	| JsonSafeValue[]
	| { [key: string]: JsonSafeValue };

function toJsonSafeValue(value: unknown): JsonSafeValue {
	if (
		value === null ||
		value === undefined ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value ?? null;
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (Array.isArray(value)) {
		return value.map(toJsonSafeValue);
	}
	if (typeof value === "object") {
		const result: Record<string, JsonSafeValue> = {};
		for (const [key, val] of Object.entries(value)) {
			result[key] = toJsonSafeValue(val);
		}
		return result;
	}
	return null;
}

const StaleInProgressJobMs = 60 * 60 * 1000;
const JobHeartbeatMs = 5 * 60 * 1000;
const PublicJobFailureMessage = "Job failed";

export class JobWorker {
	private isRunning = false;
	private timeoutId: NodeJS.Timeout | null = null;
	private isPolling = false;
	private pollRequested = false;
	private recoverStaleJobsIntervalId: NodeJS.Timeout | null = null;
	private pollIntervalMs = 1000;
	private concurrency = 3;
	private aiConcurrency = 1;
	private activeJobs = 0;
	private activeAiJobs = 0;
	private activeThumbnailJobs = 0;
	private activeExportJobs = 0;
	private preferDownloads = true;

	private readonly jobRepo: IJobRepository;
	private readonly processor: (job: Job) => Promise<unknown>;

	private readonly aiJobTypes = new Set([
		"auto_tagging",
		"extract_ccip_vector",
	]);
	private readonly thumbnailJobTypes = new Set(["generate_thumbnail"]);
	private readonly exportJobTypes = new Set(["source_export"]);

	constructor(
		jobRepo: IJobRepository,
		processor: (job: Job) => Promise<unknown>,
		private readonly downloads?: DownloadWorker,
		private readonly batches?: BatchWorker,
		private readonly sources?: SourceWorker,
	) {
		this.jobRepo = jobRepo;
		this.processor = processor;
	}

	start() {
		if (this.isRunning) {
			return;
		}
		this.isRunning = true;
		logger.info("Job processing worker started");
		void this.recoverStaleJobs();
		this.recoverStaleJobsIntervalId = setInterval(
			() => void this.recoverStaleJobs(),
			5 * 60 * 1000,
		);
		void this.poll();
	}

	async stop() {
		this.isRunning = false;
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		this.pollRequested = false;
		if (this.recoverStaleJobsIntervalId) {
			clearInterval(this.recoverStaleJobsIntervalId);
			this.recoverStaleJobsIntervalId = null;
		}
		logger.info("Job processing worker stopped");
		if (this.sources) {
			while (this.isPolling) await yieldPoll();
			await this.sources.stop();
		}
	}

	updateConfig(config: AppConfig) {
		const oldConcurrency = this.concurrency;
		const oldAiConcurrency = this.aiConcurrency;
		const oldPollInterval = this.pollIntervalMs;

		this.concurrency = config.jobs.concurrency;
		this.aiConcurrency = config.jobs.aiConcurrency;
		this.pollIntervalMs = config.jobs.pollIntervalMs;

		if (
			(oldConcurrency !== this.concurrency ||
				oldAiConcurrency !== this.aiConcurrency ||
				oldPollInterval !== this.pollIntervalMs) &&
			this.isRunning
		) {
			logger.info(
				{
					concurrency: this.concurrency,
					aiConcurrency: this.aiConcurrency,
					pollIntervalMs: this.pollIntervalMs,
				},
				"JobWorker config updated",
			);
		}
	}

	private async poll() {
		if (!this.isRunning || this.isPolling) {
			return;
		}
		this.isPolling = true;
		this.pollRequested = false;

		try {
			// Reconcile durable batch outcomes even when general slots are full.
			await this.batches?.claimPending(0);
			// 1. Poll AI Jobs
			if (!this.batches && this.activeAiJobs < this.aiConcurrency) {
				const slots = this.aiConcurrency - this.activeAiJobs;
				if (slots > 0) {
					const jobs = await this.jobRepo.claimPending(slots, {
						includeTypes: Array.from(this.aiJobTypes),
					});
					for (const job of jobs) {
						void this.tryProcessJob(job);
					}
				}
			}

			// 2. Keep thumbnail warming in its own single-worker pool. A burst of
			// cache misses must not consume the general job concurrency.
			if (!this.batches && this.activeThumbnailJobs < 1) {
				const jobs = await this.jobRepo.claimPending(1, {
					includeTypes: Array.from(this.thumbnailJobTypes),
				});
				for (const job of jobs) {
					void this.tryProcessJob(job);
				}
			}

			// 3. Keep source exports in a single-worker pool. A TAR export is
			// disk-backed, but concurrent archives still multiply stream buffers and
			// database page memory.
			if (this.sources && this.activeExportJobs < 1) {
				for (const claim of await this.sources.claimPending(["export"], 1))
					this.processSource(claim);
			}
			if (!this.sources && this.activeExportJobs < 1) {
				const jobs = await this.jobRepo.claimPending(1, {
					includeTypes: Array.from(this.exportJobTypes),
				});
				for (const job of jobs) {
					void this.tryProcessJob(job);
				}
			}

			// 4. Poll Other Jobs
			// "concurrency" is treated as the limit for NON-AI jobs in this independent pool model
			const activeOtherJobs =
				this.activeJobs -
				this.activeAiJobs -
				this.activeThumbnailJobs -
				this.activeExportJobs;
			if (activeOtherJobs < this.concurrency) {
				let slots = this.concurrency - activeOtherJobs;
				if (slots > 0) {
					// Alternate the first claimant so neither typed downloads nor other general jobs starve.
					if (this.downloads && this.preferDownloads) {
						const downloads = await this.downloads.claimPending(slots);
						for (const run of downloads) this.processDownload(run);
						slots -= downloads.length;
					}
					const jobs = await this.jobRepo.claimPending(slots, {
						excludeTypes: [
							...this.aiJobTypes,
							...this.thumbnailJobTypes,
							...this.exportJobTypes,
							...(this.batches ? retiredBatchJobTypes : []),
							...(this.sources ? retiredSourceJobTypes : []),
						],
					});
					for (const job of jobs) {
						void this.tryProcessJob(job);
					}
					if (this.downloads && !this.preferDownloads && slots > jobs.length) {
						const downloads = await this.downloads.claimPending(
							slots - jobs.length,
						);
						for (const run of downloads) this.processDownload(run);
					}
					if (this.sources) {
						const available =
							this.concurrency -
							(this.activeJobs -
								this.activeAiJobs -
								this.activeThumbnailJobs -
								this.activeExportJobs);
						for (const claim of await this.sources.claimPending(
							["sync", "restore"],
							Math.max(0, available),
						))
							this.processSource(claim);
					}
					if (this.batches) {
						const available =
							this.concurrency -
							(this.activeJobs -
								this.activeAiJobs -
								this.activeThumbnailJobs -
								this.activeExportJobs);
						for (const claim of await this.batches.claimPending(
							Math.max(0, available),
						))
							this.processBatch(claim);
					}
					this.preferDownloads = !this.preferDownloads;
				}
			}
		} catch (error) {
			logger.error({ err: error }, "Error polling for jobs");
		} finally {
			this.isPolling = false;
			if (this.isRunning) {
				const nextDelay = this.pollRequested ? 0 : this.pollIntervalMs;
				this.pollRequested = false;
				this.schedulePoll(nextDelay);
			}
		}
	}

	private processSource(claim: SourceRunClaim) {
		if (!this.sources) throw new Error("Source worker is not configured");
		this.activeJobs++;
		if (claim.kind === "export") this.activeExportJobs++;
		void this.sources
			.process(claim)
			.catch((err) =>
				logger.error(
					{ err, runId: claim.id },
					"Source outcome persistence failed",
				),
			)
			.finally(() => {
				this.activeJobs--;
				if (claim.kind === "export") this.activeExportJobs--;
				this.requestPoll();
			});
	}
	private processBatch(claim: BatchClaim) {
		const batches = this.batches;
		if (!batches) throw new Error("Batch worker is not configured");
		this.activeJobs++;
		void batches
			.process(claim)
			.catch((err) =>
				logger.warn({ err, runId: claim.id }, "Batch dispatch interrupted"),
			)
			.finally(() => {
				this.activeJobs--;
				this.requestPoll();
			});
	}

	private schedulePoll(delayMs: number): void {
		if (!this.isRunning) {
			return;
		}
		if (this.timeoutId) {
			if (delayMs !== 0) {
				return;
			}
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		this.timeoutId = setTimeout(() => {
			this.timeoutId = null;
			void this.poll();
		}, delayMs);
	}

	private requestPoll(): void {
		if (!this.isRunning) {
			return;
		}
		this.pollRequested = true;
		if (!this.isPolling) {
			this.schedulePoll(0);
		}
	}

	private async tryProcessJob(job: Job) {
		void this.processJob(job).catch((error) => {
			logger.error(
				{ err: error, jobId: job.id },
				"Failed to persist job outcome",
			);
		});
	}
	private processDownload(run: DownloadClaim) {
		if (!this.downloads) return;
		this.activeJobs++;
		void this.downloads
			.process(run)
			.catch((error) => {
				logger.error(
					{ err: error, runId: run.id },
					"Failed to persist download outcome",
				);
			})
			.finally(() => {
				this.activeJobs--;
				this.requestPoll();
			});
	}

	private publish(command: JobEvent): void {
		try {
			RealtimeEventBus.publishJob(command.event, command.data);
		} catch (error) {
			logger.warn({ err: error }, "Job outcome notification failed");
		}
	}

	private async processJob(job: Job) {
		const attemptCount = job.attemptCount ?? 0;
		this.activeJobs++;
		const isAiJob = this.aiJobTypes.has(job.type);
		const isThumbnailJob = this.thumbnailJobTypes.has(job.type);
		const isExportJob = this.exportJobTypes.has(job.type);
		const startedAt = Date.now();
		if (isAiJob) {
			this.activeAiJobs++;
		}
		if (isThumbnailJob) {
			this.activeThumbnailJobs++;
		}
		if (isExportJob) {
			this.activeExportJobs++;
		}
		const heartbeatId = setInterval(() => {
			void Promise.resolve(this.jobRepo.heartbeat(job.id, attemptCount)).catch(
				(error) => {
					logger.error(
						{ err: error, jobId: job.id },
						"Failed to update job heartbeat",
					);
				},
			);
		}, JobHeartbeatMs);

		logger.info(
			{
				jobId: job.id,
				type: job.type,
				mediaSourceId: job.mediaSourceId,
				parentId: job.parentId,
				isAiJob,
			},
			"Job started",
		);
		try {
			if (await this.jobRepo.isCancellationRequested(job.id)) {
				await this.markCancelled(job);
				return;
			}

			const result = await this.processor(job);
			const safeResult =
				result !== undefined ? toJsonSafeValue(result) : { success: true };
			if (await this.jobRepo.isCancellationRequested(job.id)) {
				await this.markCancelled(job);
				return;
			} else {
				const completed = await this.jobRepo.markAsCompleted(
					job.id,
					safeResult,
					attemptCount,
				);
				if (!completed) {
					logger.warn(
						{ jobId: job.id, attemptCount },
						"Discarded completion for stale job attempt",
					);
					return;
				}
				this.publish({
					event: "job-completed",
					data: {
						jobId: job.id,
						message: "Job completed",
					},
				});
			}
			logger.info(
				{
					jobId: job.id,
					type: job.type,
					mediaSourceId: job.mediaSourceId,
					parentId: job.parentId,
					durationMs: Date.now() - startedAt,
				},
				"Job completed",
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (await this.jobRepo.isCancellationRequested(job.id)) {
				await this.markCancelled(job);
				return;
			}

			logger.error(
				{
					err: error,
					jobId: job.id,
					type: job.type,
					mediaSourceId: job.mediaSourceId,
					parentId: job.parentId,
					durationMs: Date.now() - startedAt,
				},
				"Job failed",
			);
			const failed = await this.jobRepo.markAsFailed(
				job.id,
				errorMessage,
				attemptCount,
			);
			if (!failed) {
				logger.warn(
					{ jobId: job.id, attemptCount },
					"Discarded failure for stale job attempt",
				);
				return;
			}
			this.publish({
				event: "job-failed",
				data: {
					jobId: job.id,
					error: PublicJobFailureMessage,
				},
			});
			if (job.parentId) {
				try {
					const parent = await this.jobRepo.findById(job.parentId);
					if (
						parent?.status === "failed" &&
						isBatchParentJobType(parent.type)
					) {
						this.publish({
							event: "job-failed",
							data: { jobId: parent.id, error: PublicJobFailureMessage },
						});
					}
				} catch (notificationError) {
					logger.warn(
						{ err: notificationError, parentId: job.parentId },
						"Failed to notify batch outcome",
					);
				}
			}
		} finally {
			clearInterval(heartbeatId);
			this.activeJobs--;
			if (isAiJob) {
				this.activeAiJobs--;
			}
			if (isThumbnailJob) {
				this.activeThumbnailJobs--;
			}
			if (isExportJob) {
				this.activeExportJobs--;
			}
			if (isThumbnailJob) {
				this.requestPoll();
			}
		}
	}

	private async markCancelled(job: Job): Promise<void> {
		const cancelled = await this.jobRepo.markAsCancelled(
			job.id,
			undefined,
			job.attemptCount ?? 0,
		);
		if (!cancelled) {
			logger.warn(
				{ jobId: job.id, attemptCount: job.attemptCount ?? 0 },
				"Discarded cancellation for stale job attempt",
			);
			return;
		}
		if (job.artifactPath) {
			await removeJobTransferFile(job.artifactPath);
		}
		this.publish({
			event: "job-cancelled",
			data: {
				jobId: job.id,
				message: "Job cancelled",
			},
		});
		logger.info(
			{
				jobId: job.id,
				type: job.type,
				mediaSourceId: job.mediaSourceId,
				parentId: job.parentId,
			},
			"Job cancelled",
		);
	}
	private async recoverStaleJobs() {
		const olderThan = new Date(Date.now() - StaleInProgressJobMs);
		try {
			const count = await this.jobRepo.requeueStaleInProgress(olderThan);
			if (count > 0) {
				logger.warn({ count, olderThan }, "Requeued stale in-progress jobs");
			}
			if (this.sources) {
				await this.sources.cleanup();
				return;
			}
			try {
				const orphaned = await cleanupOrphanedJobTransferFiles(
					this.jobRepo.findById.bind(this.jobRepo),
				);
				if (orphaned.removedFiles > 0) {
					logger.info(
						{
							removedFiles: orphaned.removedFiles,
							removedBytes: orphaned.removedBytes,
						},
						"Removed orphaned job transfer files",
					);
				}
			} catch (error) {
				logger.error(
					{ err: error },
					"Failed to clean up orphaned transfer files",
				);
			}
			await cleanupExpiredJobTransferFiles();
		} catch (error) {
			logger.error(
				{ err: error },
				"Failed to recover stale jobs or clean up transfer files",
			);
		}
	}
}

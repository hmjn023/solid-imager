import type { AppConfig } from '@solid-imager/core/domain/config/config-schema';
import {
	JOB_HEARTBEAT_MS,
	retryDelayMs,
} from '@solid-imager/core/domain/jobs/registry';
import type {
	ClaimFence,
	IJobRepository,
	Job,
} from '@solid-imager/core/domain/repositories/job-repository';
import { RealtimeEventBus } from '~/infrastructure/events/realtime-event-bus';
import { NonRetryableJobError } from '~/infrastructure/jobs/job-errors';
import { logger } from '~/infrastructure/logger';

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
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value ?? null;
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (Array.isArray(value)) {
		return value.map(toJsonSafeValue);
	}
	if (typeof value === 'object') {
		const result: Record<string, JsonSafeValue> = {};
		for (const [key, item] of Object.entries(value)) {
			result[key] = toJsonSafeValue(item);
		}
		return result;
	}
	return null;
}

const LEASE_RECOVERY_INTERVAL_MS = 60 * 1000;

export class JobWorker {
	private isRunning = false;
	private timeoutId: NodeJS.Timeout | null = null;
	private recoverStaleJobsIntervalId: NodeJS.Timeout | null = null;
	private pollIntervalMs = 1000;
	private concurrency = 3;
	private aiConcurrency = 1;
	private activeJobs = 0;
	private activeAiJobs = 0;
	private readonly activeLanceDbSyncKeys = new Set<string>();
	private readonly workerId = `worker-${globalThis.crypto.randomUUID()}`;

	private readonly jobRepo: IJobRepository;
	private readonly processor: (job: Job, signal?: AbortSignal) => Promise<unknown>;

	private readonly aiJobTypes = new Set([
		'auto_tagging',
		'extract_ccip_vector',
	]);

	constructor(
		jobRepo: IJobRepository,
		processor: (job: Job, signal?: AbortSignal) => Promise<unknown>,
	) {
		this.jobRepo = jobRepo;
		this.processor = processor;
	}

	start(): void {
		if (this.isRunning) return;
		this.isRunning = true;
		logger.info({ workerId: this.workerId }, 'Job processing worker started');
		void this.recoverExpiredLeases();
		this.recoverStaleJobsIntervalId = setInterval(
			() => void this.recoverExpiredLeases(),
			LEASE_RECOVERY_INTERVAL_MS,
		);
		void this.poll();
	}

	stop(): void {
		this.isRunning = false;
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		if (this.recoverStaleJobsIntervalId) {
			clearInterval(this.recoverStaleJobsIntervalId);
			this.recoverStaleJobsIntervalId = null;
		}
		logger.info({ workerId: this.workerId }, 'Job processing worker stopped');
	}

	updateConfig(config: AppConfig): void {
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
				'JobWorker config updated',
			);
		}
	}

	private async poll(): Promise<void> {
		if (!this.isRunning) return;

		try {
			if (this.activeAiJobs < this.aiConcurrency) {
				const slots = this.aiConcurrency - this.activeAiJobs;
				const claimed = await this.jobRepo.claimPending(slots, {
					includeTypes: [...this.aiJobTypes],
					queueNames: ['ai'],
					workerId: this.workerId,
				});
				for (const job of claimed) void this.tryProcessJob(job);
			}

			const activeOtherJobs = this.activeJobs - this.activeAiJobs;
			if (activeOtherJobs < this.concurrency) {
				const slots = this.concurrency - activeOtherJobs;
				const claimed = await this.jobRepo.claimPending(slots, {
					excludeTypes: [...this.aiJobTypes],
					queueNames: ['default'],
					excludeLanceDbSourceIds: [...this.activeLanceDbSyncKeys],
					workerId: this.workerId,
				});
				for (const job of claimed) void this.tryProcessJob(job);
			}
		} catch (error) {
			logger.error({ err: error, workerId: this.workerId }, 'Error polling for jobs');
		}

		if (this.isRunning) {
			this.timeoutId = setTimeout(() => void this.poll(), this.pollIntervalMs);
		}
	}

	private async tryProcessJob(job: Job): Promise<void> {
		const fence = getClaimFence(job);
		if (!fence) {
			logger.error(
				{ jobId: job.id, workerId: this.workerId },
				'Claimed job is missing a claim token',
			);
			return;
		}

		const lanceDbSyncKey = getLanceDbSyncKey(job);
		if (lanceDbSyncKey && this.activeLanceDbSyncKeys.has(lanceDbSyncKey)) {
			logger.warn(
				{ jobId: job.id, mediaSourceId: lanceDbSyncKey },
				'Releasing overlapping claimed LanceDB sync job',
			);
			await this.jobRepo.releaseClaim(job.id, fence);
			return;
		}
		if (lanceDbSyncKey) this.activeLanceDbSyncKeys.add(lanceDbSyncKey);

		await this.processJob(job, fence, lanceDbSyncKey);
	}

	private async processJob(
		job: Job,
		fence: ClaimFence,
		lanceDbSyncKey?: string,
	): Promise<void> {
		this.activeJobs++;
		const isAiJob = this.aiJobTypes.has(job.type);
		if (isAiJob) this.activeAiJobs++;
		const startedAt = Date.now();
		const abortController = new AbortController();
		let heartbeatInFlight = false;
		let leaseLost = false;
		const heartbeatId = setInterval(() => {
			if (heartbeatInFlight || leaseLost) return;
			heartbeatInFlight = true;
			void this.jobRepo
				.heartbeatClaim(job.id, fence)
				.then((accepted) => {
					if (!accepted) {
						leaseLost = true;
						abortController.abort();
						logger.warn(
							{ jobId: job.id, claimToken: fence.claimToken },
							'Job lease was lost; discarding worker output',
						);
					}
				})
				.catch((error) => {
					logger.error({ err: error, jobId: job.id }, 'Job heartbeat failed');
				})
				.finally(() => {
					heartbeatInFlight = false;
				});
		}, JOB_HEARTBEAT_MS);

		logger.info(
			{
				jobId: job.id,
				type: job.type,
				attemptCount: job.attemptCount,
				mediaSourceId: job.mediaSourceId,
				parentId: job.parentId,
				workerId: this.workerId,
			},
			'Job started',
		);

		try {
			const result = await this.processor(job, abortController.signal);
			if (leaseLost || abortController.signal.aborted) return;
			const safeResult =
				result !== undefined ? toJsonSafeValue(result) : { success: true };
			const accepted = await this.jobRepo.completeClaim(job.id, fence, safeResult);
			if (!accepted) {
				logger.warn(
					{ jobId: job.id, claimToken: fence.claimToken },
					'Completion was rejected by the job claim fence',
				);
				return;
			}
			RealtimeEventBus.publishJob('job-completed', {
				jobId: job.id,
				message: `${job.type} completed`,
			});
			await this.reconcileParent(job);
			logger.info(
				{
					jobId: job.id,
					type: job.type,
					durationMs: Date.now() - startedAt,
				},
				'Job completed',
			);
		} catch (error) {
			if (leaseLost || abortController.signal.aborted) return;
			const errorMessage = error instanceof Error ? error.message : String(error);
			const nonRetryable = error instanceof NonRetryableJobError;
			const failure = await this.jobRepo.failClaim(job.id, fence, {
				error: errorMessage,
				errorCode: nonRetryable ? error.code : 'JOB_EXECUTION_FAILED',
				retryable: !nonRetryable,
				retryAt: new Date(Date.now() + retryDelayMs(job.attemptCount)),
			});
			if (!failure) {
				logger.warn(
					{ jobId: job.id, claimToken: fence.claimToken },
					'Failure was rejected by the job claim fence',
				);
				return;
			}
			logger.error(
				{
					err: error,
					jobId: job.id,
					type: job.type,
					attemptCount: failure.attemptCount,
					status: failure.status,
					durationMs: Date.now() - startedAt,
				},
				failure.status === 'pending' ? 'Job scheduled for retry' : 'Job failed',
			);
			if (failure.status === 'failed') {
				RealtimeEventBus.publishJob('job-failed', {
					jobId: job.id,
					error: errorMessage,
				});
				if (isDispatchJob(job) && job.parentId) {
					await this.jobRepo.update(job.parentId, {
						status: 'failed',
						error: `Dispatch failed: ${errorMessage}`,
						errorCode: 'DISPATCH_FAILED',
					});
					RealtimeEventBus.publishJob('job-failed', {
						jobId: job.parentId,
						error: `Dispatch failed: ${errorMessage}`,
					});
				} else {
					await this.reconcileParent(job);
				}
			}
		} finally {
			clearInterval(heartbeatId);
			this.activeJobs--;
			if (isAiJob) this.activeAiJobs--;
			if (lanceDbSyncKey) this.activeLanceDbSyncKeys.delete(lanceDbSyncKey);
		}
	}

	private async reconcileParent(job: Job): Promise<void> {
		if (!job.parentId) return;
		const reconciliation = await this.jobRepo.recomputeBatchProgress(job.parentId);
		if (!reconciliation) return;
		RealtimeEventBus.publishJob('job-progress', {
			jobId: job.parentId,
			processed: reconciliation.processed,
			total: reconciliation.total,
		});
		if (!reconciliation.transitioned) return;
		if (reconciliation.status === 'failed') {
			RealtimeEventBus.publishJob('job-failed', {
				jobId: job.parentId,
				error: `${reconciliation.failed} child job(s) failed`,
			});
		} else if (reconciliation.status === 'completed') {
			RealtimeEventBus.publishJob('job-completed', {
				jobId: job.parentId,
				message: 'Batch job completed',
			});
		}
	}

	private async recoverExpiredLeases(): Promise<void> {
		try {
			const count = await this.jobRepo.requeueExpiredLeases();
			if (count > 0) {
				logger.warn({ count }, 'Recovered expired job leases');
			}
		} catch (error) {
			logger.error({ err: error }, 'Failed to recover expired job leases');
		}
	}
}

function getClaimFence(job: Job): ClaimFence | null {
	return job.claimToken
		? { claimToken: job.claimToken, inputRevision: job.inputRevision }
		: null;
}

function getLanceDbSyncKey(job: Job): string | undefined {
	if (
		job.mediaSourceId &&
		['sync_lancedb', 'sync_lancedb_full', 'sync_lancedb_delta'].includes(
			job.type,
		)
	) {
		return job.mediaSourceId;
	}
	return undefined;
}

function isDispatchJob(job: Job): boolean {
	return (
		job.type === 'bulk_tagging_dispatch' || job.type === 'batch_ccip_dispatch'
	);
}

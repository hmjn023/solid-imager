import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { Job } from "~/infrastructure/db/schema";
import { NonRetryableJobError } from "~/infrastructure/jobs/job-errors";
import { JobWorker } from "~/infrastructure/jobs/job-worker";

// Mock logger to avoid noise
vi.mock("~/infrastructure/logger", () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		fatal: vi.fn(),
		trace: vi.fn(),
	},
	updateLogLevel: vi.fn(),
}));

describe("JobWorker", () => {
	let jobRepo: IJobRepository;
	let processor: (job: Job, signal?: AbortSignal) => Promise<unknown>;
	let worker: JobWorker;

	const TimerDelay = 100;
	const TotalExpectedCalls = 3; // AI + 2 Normal
	const makeClaimedJob = (overrides: Partial<Job>): Job => ({
		id: "11111111-1111-4111-8111-111111111111",
		type: "processMedia",
		mediaSourceId: "22222222-2222-4222-8222-222222222222",
		status: "in_progress",
		payload: {},
		result: null,
		error: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		parentId: null,
		queueName: "default",
		targetId: null,
		inputRevision: null,
		dedupeKey: null,
		concurrencyKey: null,
		availableAt: new Date("2026-01-01T00:00:00.000Z"),
		attemptCount: 1,
		maxAttempts: 5,
		leaseDurationMs: 300_000,
		claimToken: "33333333-3333-4333-8333-333333333333",
		claimedBy: "test-worker",
		claimedAt: new Date("2026-01-01T00:00:00.000Z"),
		heartbeatAt: new Date("2026-01-01T00:00:00.000Z"),
		errorCode: null,
		...overrides,
	});

	beforeEach(() => {
		vi.useFakeTimers();

		// Mock Repository
		jobRepo = {
			create: vi.fn(),
			createIfUnique: vi.fn(),
			createParentWithDispatch: vi.fn(),
			findById: vi.fn(),
			findPending: vi.fn().mockResolvedValue([]),
			claimPending: vi.fn().mockResolvedValue([]),
			heartbeatClaim: vi.fn().mockResolvedValue(true),
			completeClaim: vi.fn().mockResolvedValue(true),
			failClaim: vi
				.fn()
				.mockResolvedValue({ status: "failed", attemptCount: 1 }),
			releaseClaim: vi.fn().mockResolvedValue(true),
			recomputeBatchProgress: vi.fn().mockResolvedValue(null),
			requeueExpiredLeases: vi.fn().mockResolvedValue(0),
			requeueStaleInProgress: vi.fn().mockResolvedValue(0),
			markAsInProgress: vi.fn().mockResolvedValue(undefined),
			markAsCompleted: vi.fn().mockResolvedValue(undefined),
			markAsFailed: vi.fn().mockResolvedValue(undefined),
			update: vi.fn(),
			incrementProgress: vi.fn(),
			incrementFailedCount: vi.fn(),
		};

		processor = vi.fn().mockResolvedValue(undefined);

		worker = new JobWorker(jobRepo, processor);
	});

	afterEach(() => {
		worker.stop();
		vi.useRealTimers();
	});

	it("should respect global concurrency limit for normal jobs", async () => {
		// Setup config: concurrency 2, aiConcurrency 1
		worker.updateConfig({
			jobs: { concurrency: 2, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		// Mock 5 pending normal jobs
		const normalJobs = Array.from({ length: 5 }, (_, i) =>
			makeClaimedJob({
					id: `job-${i}`,
					type: "normal_job",
					status: "pending",
				}),
		);

		// Mock claimPending to return jobs
		// When excluding AI types, return normal jobs
		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.excludeTypes) {
					return Promise.resolve(normalJobs.slice(0, limit));
				}
				return Promise.resolve([]);
			},
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		// Should fetch 2 normal jobs
		expect(jobRepo.claimPending).toHaveBeenCalledWith(
			2,
			expect.objectContaining({
				excludeTypes: ["auto_tagging", "extract_ccip_vector"],
			}),
		);
		expect(processor).toHaveBeenCalledTimes(2);
	});

	it("should respect aiConcurrency limit for AI jobs", async () => {
		// Setup config: concurrency 3, aiConcurrency 1
		worker.updateConfig({
			jobs: { concurrency: 3, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		// Mock 3 pending AI jobs
		const aiJobs = Array.from({ length: 3 }, (_, i) =>
			makeClaimedJob({
					id: `ai-job-${i}`,
					type: "auto_tagging",
					status: "pending",
					queueName: "ai",
				}),
		);

		// Mock claimPending
		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.includeTypes) {
					return Promise.resolve(aiJobs.slice(0, limit));
				}
				return Promise.resolve([]);
			},
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		// Should fetch 1 AI job
		expect(jobRepo.claimPending).toHaveBeenCalledWith(
			1,
			expect.objectContaining({
				includeTypes: ["auto_tagging", "extract_ccip_vector"],
			}),
		);
		expect(processor).toHaveBeenCalledTimes(1);
		expect(processor).toHaveBeenCalledWith(
			expect.objectContaining({ id: "ai-job-0" }),
			expect.any(AbortSignal),
		);
	});

	it("should run AI and normal jobs concurrently up to their respective limits", async () => {
		// Setup config: concurrency 2 (for normal), aiConcurrency 1
		worker.updateConfig({
			jobs: { concurrency: 2, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		const aiJob = makeClaimedJob({
			id: "ai-1",
			type: "auto_tagging",
			status: "pending",
			queueName: "ai",
		});
		const normalJob1 = makeClaimedJob({
			id: "normal-1",
			type: "normal",
			status: "pending",
		});
		const normalJob2 = makeClaimedJob({
			id: "normal-2",
			type: "normal",
			status: "pending",
		});

		// Mock claimPending
		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.includeTypes) {
					// AI request
					return Promise.resolve([aiJob].slice(0, limit));
				}
				if (options?.excludeTypes) {
					// Normal request
					return Promise.resolve([normalJob1, normalJob2].slice(0, limit));
				}
				return Promise.resolve([]);
			},
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		// Should fetch 1 AI job and 2 Normal jobs
		expect(jobRepo.claimPending).toHaveBeenCalledWith(
			1,
			expect.objectContaining({
				includeTypes: ["auto_tagging", "extract_ccip_vector"],
			}),
		);
		expect(jobRepo.claimPending).toHaveBeenCalledWith(
			2,
			expect.objectContaining({
				excludeTypes: ["auto_tagging", "extract_ccip_vector"],
			}),
		);

		expect(processor).toHaveBeenCalledTimes(TotalExpectedCalls);
	});

	it("should use processor return value as the completed job result", async () => {
		worker.updateConfig({
			jobs: { concurrency: 1, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		const customJob = makeClaimedJob({
			id: "custom-1",
			type: "custom",
			status: "pending",
		});

		processor = vi
			.fn()
			.mockResolvedValue({ success: true, parentProcessed: true });
		worker = new JobWorker(jobRepo, processor);
		worker.updateConfig({
			jobs: { concurrency: 1, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.excludeTypes) {
					return Promise.resolve([customJob].slice(0, limit));
				}
				return Promise.resolve([]);
			},
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		expect(processor).toHaveBeenCalledWith(
			customJob,
			expect.any(AbortSignal),
		);
		expect(jobRepo.completeClaim).toHaveBeenCalledWith(
			"custom-1",
			{
				claimToken: customJob.claimToken,
				inputRevision: customJob.inputRevision,
			},
			{ success: true, parentProcessed: true },
		);
		expect(jobRepo.markAsCompleted).not.toHaveBeenCalled();
	});

	it("should requeue overlapping claimed LanceDB sync jobs per media source", async () => {
		worker.updateConfig({
			jobs: { concurrency: 3, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		let resolveProcessor: () => void = () => {};
		processor = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveProcessor = resolve;
				}),
		);
		worker = new JobWorker(jobRepo, processor);
		worker.updateConfig({
			jobs: { concurrency: 3, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		const fullSyncJob = makeClaimedJob({
			id: "lancedb-full-1",
			type: "sync_lancedb_full",
			mediaSourceId: "source-1",
			status: "pending",
		});
		const deltaSyncSameSourceJob = makeClaimedJob({
			id: "lancedb-delta-1",
			type: "sync_lancedb_delta",
			mediaSourceId: "source-1",
			status: "pending",
		});
		const deltaSyncOtherSourceJob = makeClaimedJob({
			id: "lancedb-delta-2",
			type: "sync_lancedb_delta",
			mediaSourceId: "source-2",
			status: "pending",
		});

		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.excludeTypes) {
					return Promise.resolve(
						[
							fullSyncJob,
							deltaSyncSameSourceJob,
							deltaSyncOtherSourceJob,
						].slice(0, limit),
					);
				}
				return Promise.resolve([]);
			},
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		expect(processor).toHaveBeenCalledTimes(2);
		expect(processor).toHaveBeenCalledWith(
			fullSyncJob,
			expect.any(AbortSignal),
		);
		expect(processor).not.toHaveBeenCalledWith(
			deltaSyncSameSourceJob,
			expect.any(AbortSignal),
		);
		expect(processor).toHaveBeenCalledWith(
			deltaSyncOtherSourceJob,
			expect.any(AbortSignal),
		);
		expect(jobRepo.releaseClaim).toHaveBeenCalledWith(
			deltaSyncSameSourceJob.id,
			{
				claimToken: deltaSyncSameSourceJob.claimToken,
				inputRevision: deltaSyncSameSourceJob.inputRevision,
			},
		);
		expect(jobRepo.update).not.toHaveBeenCalled();

		resolveProcessor();
		await vi.runOnlyPendingTimersAsync();
	});

	it("should pass active LanceDB sync source IDs to claimPending for exclusion", async () => {
		worker.updateConfig({
			jobs: { concurrency: 3, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		const syncJob = makeClaimedJob({
			id: "lancedb-sync-1",
			type: "sync_lancedb",
			mediaSourceId: "source-active",
			status: "pending",
		});

		let resolveProcessor: () => void = () => {};
		processor = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveProcessor = resolve;
				}),
		);
		worker = new JobWorker(jobRepo, processor);
		worker.updateConfig({
			jobs: { concurrency: 3, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		// First call: returns the sync job, making it active
		(jobRepo.claimPending as any).mockImplementationOnce(() => {
			return Promise.resolve([syncJob]);
		});

		// Second call: should include "source-active" in excludeLanceDbSourceIds
		(jobRepo.claimPending as any).mockImplementationOnce(
			(_limit: number, options: any) => {
				expect(options?.excludeLanceDbSourceIds).toContain("source-active");
				return Promise.resolve([]);
			},
		);

		worker.start();
		// Advance to trigger first poll and start processing syncJob
		await vi.advanceTimersByTimeAsync(TimerDelay);

		expect(processor).toHaveBeenCalledTimes(1);
		expect(processor).toHaveBeenCalledWith(
			syncJob,
			expect.any(AbortSignal),
		);

		// Advance to trigger second poll while syncJob is still active
		await vi.advanceTimersByTimeAsync(1000);

		expect(jobRepo.claimPending).toHaveBeenLastCalledWith(
			2, // 3 slots total - 1 active job = 2 slots remaining
			expect.objectContaining({
				excludeLanceDbSourceIds: ["source-active"],
			}),
		);

		resolveProcessor();
		await vi.runOnlyPendingTimersAsync();
	});

	it("aborts processing and discards output when the heartbeat loses its lease", async () => {
		const claimedJob = makeClaimedJob({ id: "lease-lost-1" });
		let returned = false;
		(jobRepo.claimPending as any).mockImplementation(
			(_limit: number, options: { excludeTypes?: string[] }) => {
				if (options.excludeTypes && !returned) {
					returned = true;
					return Promise.resolve([claimedJob]);
				}
				return Promise.resolve([]);
			},
		);
		(jobRepo.heartbeatClaim as any).mockResolvedValue(false);
		processor = vi.fn(
			(_job: Job, signal?: AbortSignal) =>
				new Promise((resolve) => {
					signal?.addEventListener("abort", () => resolve({ ignored: true }), {
						once: true,
					});
				}),
		);
		worker = new JobWorker(jobRepo, processor);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);
		await vi.advanceTimersByTimeAsync(30_000);

		expect(jobRepo.heartbeatClaim).toHaveBeenCalledWith("lease-lost-1", {
			claimToken: claimedJob.claimToken,
			inputRevision: claimedJob.inputRevision,
		});
		expect(jobRepo.completeClaim).not.toHaveBeenCalled();
		expect(jobRepo.failClaim).not.toHaveBeenCalled();
	});

	it("schedules retryable failures through the fenced repository transition", async () => {
		const claimedJob = makeClaimedJob({ id: "retryable-1", attemptCount: 2 });
		let returned = false;
		(jobRepo.claimPending as any).mockImplementation(
			(_limit: number, options: { excludeTypes?: string[] }) => {
				if (options.excludeTypes && !returned) {
					returned = true;
					return Promise.resolve([claimedJob]);
				}
				return Promise.resolve([]);
			},
		);
		(jobRepo.failClaim as any).mockResolvedValue({
			status: "pending",
			attemptCount: 2,
		});
		processor = vi.fn().mockRejectedValue(new Error("temporary"));
		worker = new JobWorker(jobRepo, processor);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		expect(jobRepo.failClaim).toHaveBeenCalledWith(
			"retryable-1",
			{
				claimToken: claimedJob.claimToken,
				inputRevision: claimedJob.inputRevision,
			},
			expect.objectContaining({
				error: "temporary",
				errorCode: "JOB_EXECUTION_FAILED",
				retryable: true,
				retryAt: expect.any(Date),
			}),
		);
		expect(jobRepo.recomputeBatchProgress).not.toHaveBeenCalled();
	});

	it("marks validation failures as non-retryable", async () => {
		const claimedJob = makeClaimedJob({ id: "invalid-1" });
		let returned = false;
		(jobRepo.claimPending as any).mockImplementation(
			(_limit: number, options: { excludeTypes?: string[] }) => {
				if (options.excludeTypes && !returned) {
					returned = true;
					return Promise.resolve([claimedJob]);
				}
				return Promise.resolve([]);
			},
		);
		processor = vi
			.fn()
			.mockRejectedValue(
				new NonRetryableJobError("INVALID_JOB_PAYLOAD", "invalid payload"),
			);
		worker = new JobWorker(jobRepo, processor);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		expect(jobRepo.failClaim).toHaveBeenCalledWith(
			"invalid-1",
			expect.any(Object),
			expect.objectContaining({
				errorCode: "INVALID_JOB_PAYLOAD",
				retryable: false,
			}),
		);
	});

	it("recomputes parent progress only after a child completes terminally", async () => {
		const claimedJob = makeClaimedJob({
			id: "child-1",
			parentId: "parent-1",
		});
		let returned = false;
		(jobRepo.claimPending as any).mockImplementation(
			(_limit: number, options: { excludeTypes?: string[] }) => {
				if (options.excludeTypes && !returned) {
					returned = true;
					return Promise.resolve([claimedJob]);
				}
				return Promise.resolve([]);
			},
		);
		(jobRepo.recomputeBatchProgress as any).mockResolvedValue({
			processed: 1,
			failed: 0,
			total: 1,
			status: "completed",
			transitioned: true,
		});

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		expect(jobRepo.completeClaim).toHaveBeenCalled();
		expect(jobRepo.recomputeBatchProgress).toHaveBeenCalledWith("parent-1");
	});
});

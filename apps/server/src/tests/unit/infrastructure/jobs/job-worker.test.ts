import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { Job } from "~/infrastructure/db/schema";
import { JobWorker } from "~/infrastructure/jobs/job-worker";

const { mockCleanupExpired, mockCleanupOrphaned } = vi.hoisted(() => ({
	mockCleanupExpired: vi.fn().mockResolvedValue(undefined),
	mockCleanupOrphaned: vi
		.fn()
		.mockResolvedValue({ removedFiles: 0, removedBytes: 0 }),
}));

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

vi.mock("~/infrastructure/services/job-transfer-storage", () => ({
	cleanupExpiredJobTransferFiles: mockCleanupExpired,
	cleanupOrphanedJobTransferFiles: mockCleanupOrphaned,
	removeJobTransferFile: vi.fn(),
}));

describe("JobWorker", () => {
	let jobRepo: IJobRepository;
	let processor: (job: Job) => Promise<void>;
	let worker: JobWorker;

	const TimerDelay = 100;
	const TotalExpectedCalls = 3; // AI + 2 Normal

	beforeEach(() => {
		vi.useFakeTimers();
		mockCleanupExpired.mockReset().mockResolvedValue(undefined);
		mockCleanupOrphaned
			.mockReset()
			.mockResolvedValue({ removedFiles: 0, removedBytes: 0 });

		// Mock Repository
		jobRepo = {
			create: vi.fn(),
			createIfUnique: vi.fn(),
			findById: vi.fn(),
			findPending: vi.fn().mockResolvedValue([]),
			claimPending: vi.fn().mockResolvedValue([]),
			requeueStaleInProgress: vi.fn().mockResolvedValue(0),
			markAsInProgress: vi.fn().mockResolvedValue(undefined),
			markAsCompleted: vi.fn().mockResolvedValue(true),
			markAsFailed: vi.fn().mockResolvedValue(true),
			requestCancellation: vi.fn().mockResolvedValue(undefined),
			markAsCancelled: vi.fn().mockResolvedValue(true),
			isCancellationRequested: vi.fn().mockResolvedValue(false),
			setArtifact: vi.fn().mockResolvedValue(undefined),
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
		const normalJobs = Array.from(
			{ length: 5 },
			(_, i) =>
				({
					id: `job-${i}`,
					type: "normal_job",
					status: "pending",
				}) as Job,
		);

		// Mock claimPending to return jobs
		// When excluding AI types, return normal jobs
		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.includeTypes?.includes("generate_thumbnail")) {
					return Promise.resolve([]);
				}
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
				excludeTypes: [
					"auto_tagging",
					"extract_ccip_vector",
					"generate_thumbnail",
					"source_export",
				],
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
		const aiJobs = Array.from(
			{ length: 3 },
			(_, i) =>
				({
					id: `ai-job-${i}`,
					type: "auto_tagging",
					status: "pending",
				}) as Job,
		);

		// Mock claimPending
		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.includeTypes?.includes("generate_thumbnail")) {
					return Promise.resolve([]);
				}
				if (options?.includeTypes?.includes("source_export")) {
					return Promise.resolve([]);
				}
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
		);
	});

	it("should run AI and normal jobs concurrently up to their respective limits", async () => {
		// Setup config: concurrency 2 (for normal), aiConcurrency 1
		worker.updateConfig({
			jobs: { concurrency: 2, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		const aiJob = {
			id: "ai-1",
			type: "auto_tagging",
			status: "pending",
		} as Job;
		const normalJob1 = {
			id: "normal-1",
			type: "normal",
			status: "pending",
		} as Job;
		const normalJob2 = {
			id: "normal-2",
			type: "normal",
			status: "pending",
		} as Job;

		// Mock claimPending
		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.includeTypes?.includes("generate_thumbnail")) {
					return Promise.resolve([]);
				}
				if (options?.includeTypes?.includes("source_export")) {
					return Promise.resolve([]);
				}
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
				excludeTypes: [
					"auto_tagging",
					"extract_ccip_vector",
					"generate_thumbnail",
					"source_export",
				],
			}),
		);

		expect(processor).toHaveBeenCalledTimes(TotalExpectedCalls);
	});

	it("should use processor return value as the completed job result", async () => {
		worker.updateConfig({
			jobs: { concurrency: 1, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		const customJob = {
			id: "custom-1",
			type: "custom",
			status: "pending",
		} as Job;

		processor = vi
			.fn()
			.mockResolvedValue({ success: true, parentProcessed: true });
		worker = new JobWorker(jobRepo, processor);
		worker.updateConfig({
			jobs: { concurrency: 1, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);

		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) => {
				if (options?.includeTypes?.includes("generate_thumbnail")) {
					return Promise.resolve([]);
				}
				if (options?.excludeTypes) {
					return Promise.resolve([customJob].slice(0, limit));
				}
				return Promise.resolve([]);
			},
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		expect(processor).toHaveBeenCalledWith(customJob);
		expect(jobRepo.markAsCompleted).toHaveBeenCalledWith(
			"custom-1",
			{
				success: true,
				parentProcessed: true,
			},
			0,
		);
	});

	it("processes at most one thumbnail generation job at a time", async () => {
		let resolveThumbnail: () => void = () => {};
		processor = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveThumbnail = resolve;
				}),
		);
		worker = new JobWorker(jobRepo, processor);
		const thumbnailJob = {
			id: "thumbnail-1",
			type: "generate_thumbnail",
			status: "pending",
		} as Job;
		let thumbnailClaimed = false;
		(jobRepo.claimPending as any).mockImplementation(
			(_limit: number, options: any) => {
				if (!options?.includeTypes?.includes("generate_thumbnail")) {
					return Promise.resolve([]);
				}
				if (thumbnailClaimed) {
					return Promise.resolve([]);
				}
				thumbnailClaimed = true;
				return Promise.resolve([thumbnailJob]);
			},
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);
		await vi.advanceTimersByTimeAsync(1000);

		expect(processor).toHaveBeenCalledTimes(1);
		expect(jobRepo.claimPending).toHaveBeenCalledWith(1, {
			includeTypes: ["generate_thumbnail"],
		});
		resolveThumbnail();
		await vi.runOnlyPendingTimersAsync();
	});

	it("wakes the thumbnail pool immediately after a job completes", async () => {
		const thumbnailJobs = [
			{
				id: "thumbnail-1",
				type: "generate_thumbnail",
				status: "pending",
			} as Job,
			{
				id: "thumbnail-2",
				type: "generate_thumbnail",
				status: "pending",
			} as Job,
		];
		(jobRepo.claimPending as any).mockImplementation(
			(_limit: number, options: any) =>
				Promise.resolve(
					options?.includeTypes?.includes("generate_thumbnail")
						? thumbnailJobs.splice(0, 1)
						: [],
				),
		);

		worker.updateConfig({
			jobs: { concurrency: 1, aiConcurrency: 1, pollIntervalMs: 1000 },
		} as AppConfig);
		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		expect(processor).toHaveBeenCalledTimes(2);
		expect(processor).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ id: "thumbnail-1" }),
		);
		expect(processor).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ id: "thumbnail-2" }),
		);
	});

	it("processes at most one source export job at a time", async () => {
		let resolveExport: () => void = () => {};
		processor = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveExport = resolve;
				}),
		);
		worker = new JobWorker(jobRepo, processor);
		const exportJob = {
			id: "export-1",
			type: "source_export",
			status: "pending",
		} as Job;
		(jobRepo.claimPending as any).mockImplementation(
			(limit: number, options: any) =>
				Promise.resolve(
					options?.includeTypes?.includes("source_export")
						? [exportJob].slice(0, limit)
						: [],
				),
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);
		await vi.advanceTimersByTimeAsync(1000);

		expect(processor).toHaveBeenCalledTimes(1);
		expect(jobRepo.claimPending).toHaveBeenCalledWith(1, {
			includeTypes: ["source_export"],
		});

		resolveExport();
		await vi.runOnlyPendingTimersAsync();
	});

	it("still expires transfer files when orphan cleanup fails", async () => {
		mockCleanupOrphaned.mockRejectedValueOnce(new Error("cleanup failed"));

		await (
			worker as unknown as { recoverStaleJobs: () => Promise<void> }
		).recoverStaleJobs();

		expect(mockCleanupExpired).toHaveBeenCalledTimes(1);
	});
});

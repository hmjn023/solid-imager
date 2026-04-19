import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { Job } from "~/infrastructure/db/schema";
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
	let processor: (job: Job) => Promise<void>;
	let worker: JobWorker;

	const TimerDelay = 100;
	const TotalExpectedCalls = 3; // AI + 2 Normal

	beforeEach(() => {
		vi.useFakeTimers();

		// Mock Repository
		jobRepo = {
			create: vi.fn(),
			createIfUnique: vi.fn(),
			findById: vi.fn(),
			findPending: vi.fn().mockResolvedValue([]),
			markAsInProgress: vi.fn().mockResolvedValue(undefined),
			markAsCompleted: vi.fn().mockResolvedValue(undefined),
			markAsFailed: vi.fn().mockResolvedValue(undefined),
			update: vi.fn(),
			incrementProgress: vi.fn(),
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

		// Mock findPending to return jobs
		// When excluding AI types, return normal jobs
		(jobRepo.findPending as any).mockImplementation((limit: number, options: any) => {
			if (options?.excludeTypes) {
				return Promise.resolve(normalJobs.slice(0, limit));
			}
			return Promise.resolve([]);
		});

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		// Should fetch 2 normal jobs
		expect(jobRepo.findPending).toHaveBeenCalledWith(
			2,
			expect.objectContaining({ excludeTypes: ["auto_tagging"] }),
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

		// Mock findPending
		(jobRepo.findPending as any).mockImplementation((limit: number, options: any) => {
			if (options?.includeTypes) {
				return Promise.resolve(aiJobs.slice(0, limit));
			}
			return Promise.resolve([]);
		});

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		// Should fetch 1 AI job
		expect(jobRepo.findPending).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ includeTypes: ["auto_tagging"] }),
		);
		expect(processor).toHaveBeenCalledTimes(1);
		expect(processor).toHaveBeenCalledWith(expect.objectContaining({ id: "ai-job-0" }));
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

		// Mock findPending
		(jobRepo.findPending as any).mockImplementation((limit: number, options: any) => {
			if (options?.includeTypes) {
				// AI request
				return Promise.resolve([aiJob].slice(0, limit));
			}
			if (options?.excludeTypes) {
				// Normal request
				return Promise.resolve([normalJob1, normalJob2].slice(0, limit));
			}
			return Promise.resolve([]);
		});

		worker.start();
		await vi.advanceTimersByTimeAsync(TimerDelay);

		// Should fetch 1 AI job and 2 Normal jobs
		expect(jobRepo.findPending).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ includeTypes: ["auto_tagging"] }),
		);
		expect(jobRepo.findPending).toHaveBeenCalledWith(
			2,
			expect.objectContaining({ excludeTypes: ["auto_tagging"] }),
		);

		expect(processor).toHaveBeenCalledTimes(TotalExpectedCalls);
	});
});

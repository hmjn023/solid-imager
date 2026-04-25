import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import type { JobRecord, JobRepositoryPort } from "../ports/job-repository";
import { type JobProcessor, JobWorker } from "../services/job-worker";

function makeJob(id: string, type = "processMedia"): JobRecord {
	const now = new Date();
	return {
		id,
		type,
		mediaSourceId: "source-id",
		status: "pending",
		payload: {},
		result: null,
		error: null,
		createdAt: now,
		updatedAt: now,
		parentId: null,
	};
}

function makeRepository(): JobRepositoryPort {
	return {
		create: vi.fn(),
		createMany: vi.fn(),
		createIfUnique: vi.fn(),
		findById: vi.fn(),
		findPendingImportRequests: vi.fn(async () => []),
		findImportRequestsByIds: vi.fn(async () => []),
		findPending: vi.fn(async () => []),
		resetInProgressToPending: vi.fn(),
		markImportRequestsCompleted: vi.fn(),
		deleteImportRequests: vi.fn(),
		markAsInProgress: vi.fn(),
		markAsCompleted: vi.fn(),
		markAsFailed: vi.fn(),
		update: vi.fn(),
		incrementProgress: vi.fn(),
	};
}

describe("JobWorker", () => {
	let repository: JobRepositoryPort;
	let processor: ReturnType<typeof vi.fn<JobProcessor>>;
	let worker: JobWorker;

	beforeEach(() => {
		vi.useFakeTimers();
		repository = makeRepository();
		processor = vi.fn<JobProcessor>(async () => undefined);
		worker = new JobWorker({ jobRepository: repository, processor });
		worker.updateConfig({
			concurrency: 2,
			aiConcurrency: 1,
			pollIntervalMs: 10_000,
		});
	});

	afterEach(() => {
		worker.stop();
		vi.useRealTimers();
	});

	it("uses independent normal and AI concurrency pools", async () => {
		const normalJobs = [makeJob("normal-1"), makeJob("normal-2")];
		const aiJobs = [makeJob("ai-1", "auto_tagging")];
		vi.mocked(repository.findPending).mockImplementation(
			async (limit, options) => {
				if (options?.includeTypes) {
					return aiJobs.slice(0, limit);
				}
				if (options?.excludeTypes) {
					return normalJobs.slice(0, limit);
				}
				return [];
			},
		);

		worker.start();
		await vi.advanceTimersByTimeAsync(1);

		expect(repository.findPending).toHaveBeenCalledWith(1, {
			includeTypes: ["auto_tagging"],
		});
		expect(repository.findPending).toHaveBeenCalledWith(2, {
			excludeTypes: ["auto_tagging", "import_request"],
		});
		expect(processor).toHaveBeenCalledTimes(3);
	});

	it("marks successful and failed jobs", async () => {
		const success = makeJob("success");
		const failure = makeJob("failure");
		vi.mocked(repository.findPending).mockResolvedValueOnce([]);
		vi.mocked(repository.findPending).mockResolvedValueOnce([success, failure]);
		processor.mockImplementation(async (job: JobRecord) => {
			if (job.id === "failure") {
				throw new Error("failed");
			}
		});

		worker.start();
		await vi.advanceTimersByTimeAsync(1);

		expect(repository.markAsCompleted).toHaveBeenCalledWith("success", {
			success: true,
		});
		expect(repository.markAsFailed).toHaveBeenCalledWith("failure", "failed");
	});

	it("wake processes pending jobs before the next poll interval", async () => {
		const job = makeJob("job-1");
		vi.mocked(repository.findPending).mockResolvedValueOnce([]);
		worker.start();
		await vi.advanceTimersByTimeAsync(1);

		vi.mocked(repository.findPending).mockResolvedValueOnce([]);
		vi.mocked(repository.findPending).mockResolvedValueOnce([job]);
		worker.wake();
		await vi.advanceTimersByTimeAsync(1);

		expect(processor).toHaveBeenCalledWith(job);
	});

	it("re-polls immediately when wake is called during an active poll", async () => {
		const job = makeJob("job-2");
		let resolveFirstPoll!: (jobs: JobRecord[]) => void;
		const firstPoll = new Promise<JobRecord[]>((resolve) => {
			resolveFirstPoll = resolve;
		});
		let callCount = 0;
		vi.mocked(repository.findPending).mockImplementation(async () => {
			callCount++;
			if (callCount === 1) {
				return await firstPoll;
			}
			if (callCount === 4) {
				return [job];
			}
			return [];
		});

		worker.start();
		await Promise.resolve();

		worker.wake();
		resolveFirstPoll([]);
		await vi.advanceTimersByTimeAsync(1);

		expect(repository.findPending).toHaveBeenCalledTimes(4);
		expect(processor).toHaveBeenCalledWith(job);
	});
});

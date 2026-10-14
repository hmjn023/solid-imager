import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { DownloadClaim } from "@solid-imager/core/domain/downloads/schemas";
import type { BatchClaim } from "@solid-imager/core/domain/batches/schemas";
import type { SourceRunClaim } from "@solid-imager/core/domain/source-runs/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobWorker } from "~/infrastructure/jobs/job-worker";

describe("typed flow coordinator", () => {
	let worker: JobWorker;
	let releases: Array<() => void>;
	const downloads = {
		claimPending: vi.fn<(limit: number) => Promise<DownloadClaim[]>>(),
		process: vi.fn<(run: DownloadClaim) => Promise<void>>(),
	};
	const batches = {
		claimPending: vi.fn<(limit: number) => Promise<BatchClaim[]>>(),
		process: vi.fn<(run: BatchClaim) => Promise<void>>(),
	};
	const sources = {
		claimPending: vi.fn(),
		process: vi.fn<(run: SourceRunClaim) => Promise<void>>(),
		cleanup: vi.fn(),
		stop: vi.fn(),
	};
	const queues = {
		download: [] as DownloadClaim[],
		batch: [] as BatchClaim[],
		source: [] as SourceRunClaim[],
		export: [] as SourceRunClaim[],
	};
	const hold = () => new Promise<void>((resolve) => releases.push(resolve));
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetAllMocks();
		releases = [];
		for (const queue of Object.values(queues)) queue.length = 0;
		downloads.claimPending.mockImplementation(async (limit) =>
			queues.download.splice(0, limit),
		);
		batches.claimPending.mockImplementation(async (limit) =>
			queues.batch.splice(0, limit),
		);
		sources.claimPending.mockImplementation(
			async (kinds: string[], limit: number) =>
				(kinds.includes("export") ? queues.export : queues.source).splice(
					0,
					limit,
				),
		);
		downloads.process.mockImplementation(hold);
		batches.process.mockImplementation(hold);
		sources.process.mockImplementation(hold);
		sources.cleanup.mockResolvedValue(undefined);
		sources.stop.mockResolvedValue(undefined);
		worker = new JobWorker(downloads, batches, sources);
		worker.updateConfig({
			...defaultAppConfig,
			jobs: { ...defaultAppConfig.jobs, concurrency: 2, pollIntervalMs: 100 },
		});
	});
	afterEach(async () => {
		const stopping = worker.stop();
		for (const release of releases) release();
		await stopping;
		vi.useRealTimers();
	});
	it("shares general capacity while reserving only one independent export slot", async () => {
		queues.download.push(
			...([{ id: "d1" }, { id: "d2" }, { id: "d3" }] as DownloadClaim[]),
		);
		queues.batch.push({ id: "b1" } as BatchClaim);
		queues.export.push(
			...([
				{ id: "e1", kind: "export" },
				{ id: "e2", kind: "export" },
			] as SourceRunClaim[]),
		);
		worker.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(downloads.process).toHaveBeenCalledTimes(2);
		expect(sources.process).toHaveBeenCalledTimes(1);
		expect(batches.process).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(500);
		expect(downloads.process).toHaveBeenCalledTimes(2);
		expect(sources.process).toHaveBeenCalledTimes(1);
	});
	it("rotates the first claimant so download, batch and source cannot starve each other", async () => {
		worker.updateConfig({
			...defaultAppConfig,
			jobs: { ...defaultAppConfig.jobs, concurrency: 1, pollIntervalMs: 100 },
		});
		queues.download.push(...([{ id: "d1" }, { id: "d2" }] as DownloadClaim[]));
		queues.batch.push(...([{ id: "b1" }, { id: "b2" }] as BatchClaim[]));
		queues.source.push({ id: "s1", kind: "sync" } as SourceRunClaim);
		worker.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(downloads.process).toHaveBeenCalledTimes(1);
		// Busy timer ticks must not rotate back to downloads before capacity opens.
		await vi.advanceTimersByTimeAsync(500);
		releases.shift()?.();
		await vi.advanceTimersByTimeAsync(0);
		expect(batches.process).toHaveBeenCalledTimes(1);
		releases.shift()?.();
		await vi.advanceTimersByTimeAsync(0);
		expect(sources.process).toHaveBeenCalledWith(
			expect.objectContaining({ id: "s1" }),
		);
	});
	it("never overlaps a slow claim loop, including repeated start calls", async () => {
		const pending = Promise.withResolvers<SourceRunClaim[]>();
		sources.claimPending.mockImplementationOnce(() => pending.promise);
		worker.start();
		worker.start();
		await vi.advanceTimersByTimeAsync(2000);
		expect(sources.claimPending).toHaveBeenCalledTimes(1);
		pending.resolve([]);
		await vi.advanceTimersByTimeAsync(0);
	});
	it("drains already claimed work and prevents new polls after stop", async () => {
		queues.download.push({ id: "d1" } as DownloadClaim);
		worker.start();
		await vi.advanceTimersByTimeAsync(0);
		let stopped = false;
		const stopping = worker.stop().then(() => {
			stopped = true;
		});
		await Promise.resolve();
		expect(stopped).toBe(false);
		releases.shift()?.();
		await stopping;
		const before = downloads.claimPending.mock.calls.length;
		await vi.advanceTimersByTimeAsync(1000);
		expect(downloads.claimPending).toHaveBeenCalledTimes(before);
		expect(sources.stop).toHaveBeenCalled();
	});
	it("recovers from a claim failure without duplicating work or stopping future polls", async () => {
		batches.claimPending.mockRejectedValueOnce(
			new Error("temporary DB failure"),
		);
		queues.download.push({ id: "d1" } as DownloadClaim);
		worker.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(downloads.process).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(100);
		expect(downloads.process).toHaveBeenCalledTimes(1);
	});
});

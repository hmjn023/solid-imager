import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaFileWorker } from "~/infrastructure/jobs/media-file-worker";

describe("dedicated file worker pools", () => {
	afterEach(() => vi.useRealTimers());
	it("keeps thumbnails running while metadata slots are occupied, then drains both on stop", async () => {
		vi.useFakeTimers();
		let release!: () => void;
		const gate = new Promise<"completed">((resolve) => {
			release = () => resolve("completed");
		});
		const runFileTask = vi.fn(async (kind: "metadata" | "thumbnail") =>
			kind === "metadata" ? gate : ("idle" as const),
		);
		const worker = new MediaFileWorker({ runFileTask });
		worker.updateConfig({
			...defaultAppConfig,
			jobs: { ...defaultAppConfig.jobs, concurrency: 2, pollIntervalMs: 100 },
		});
		worker.start();
		await vi.advanceTimersByTimeAsync(200);
		expect(
			runFileTask.mock.calls.filter(([kind]) => kind === "metadata"),
		).toHaveLength(2);
		expect(
			runFileTask.mock.calls.filter(([kind]) => kind === "thumbnail"),
		).toHaveLength(3);
		let stopped = false;
		const stop = worker.stop().then(() => {
			stopped = true;
		});
		await Promise.resolve();
		expect(stopped).toBe(false);
		release();
		await stop;
		const calls = runFileTask.mock.calls.length;
		await vi.advanceTimersByTimeAsync(1000);
		expect(runFileTask).toHaveBeenCalledTimes(calls);
	});
	it("retries poll errors and applies increased metadata concurrency without duplicate starts", async () => {
		vi.useFakeTimers();
		const runFileTask = vi
			.fn()
			.mockRejectedValueOnce(new Error("DB unavailable"))
			.mockResolvedValue("idle");
		const worker = new MediaFileWorker({ runFileTask });
		worker.updateConfig({
			...defaultAppConfig,
			jobs: { ...defaultAppConfig.jobs, concurrency: 1, pollIntervalMs: 100 },
		});
		worker.start();
		worker.start();
		await vi.advanceTimersByTimeAsync(100);
		expect(runFileTask).toHaveBeenCalledTimes(4);
		worker.updateConfig({
			...defaultAppConfig,
			jobs: { ...defaultAppConfig.jobs, concurrency: 3, pollIntervalMs: 100 },
		});
		await vi.advanceTimersByTimeAsync(100);
		expect(runFileTask).toHaveBeenCalledTimes(10);
		await worker.stop();
	});
});

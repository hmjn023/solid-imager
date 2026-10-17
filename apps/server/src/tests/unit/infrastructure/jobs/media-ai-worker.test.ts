import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaAiWorker } from "~/infrastructure/jobs/media-ai-worker";
describe("dedicated AI inference pool", () => {
	afterEach(() => vi.useRealTimers());
	it("shares one concurrency budget across tagging and CCIP and drains active inference", async () => {
		vi.useFakeTimers();
		const release = Promise.withResolvers<"completed">();
		const runTask = vi.fn(() => release.promise);
		const worker = new MediaAiWorker(runTask);
		worker.updateConfig({
			...defaultAppConfig,
			jobs: { ...defaultAppConfig.jobs, aiConcurrency: 2, pollIntervalMs: 100 },
		});
		worker.start();
		worker.start();
		await vi.advanceTimersByTimeAsync(200);
		expect(runTask.mock.calls).toHaveLength(2);
		expect(runTask).toHaveBeenNthCalledWith(1, "tagging");
		expect(runTask).toHaveBeenNthCalledWith(2, "ccip");
		let stopped = false;
		const draining = worker.stop().then(() => {
			stopped = true;
		});
		await Promise.resolve();
		expect(stopped).toBe(false);
		release.resolve("completed");
		await draining;
		await vi.advanceTimersByTimeAsync(200);
		expect(runTask).toHaveBeenCalledTimes(2);
	});
	it("tries the other task when idle and applies reduced and increased concurrency", async () => {
		vi.useFakeTimers();
		const runTask = vi.fn().mockResolvedValue("idle");
		const worker = new MediaAiWorker(runTask);
		const config = {
			...defaultAppConfig,
			jobs: { ...defaultAppConfig.jobs, aiConcurrency: 1, pollIntervalMs: 100 },
		};
		worker.updateConfig(config);
		worker.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(runTask.mock.calls.map(([kind]) => kind)).toEqual([
			"tagging",
			"ccip",
		]);
		worker.updateConfig({
			...config,
			jobs: { ...config.jobs, aiConcurrency: 2 },
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(runTask).toHaveBeenCalledTimes(4);
		worker.updateConfig(config);
		await vi.advanceTimersByTimeAsync(100);
		expect(runTask).toHaveBeenCalledTimes(6);
		await worker.stop();
	});
});

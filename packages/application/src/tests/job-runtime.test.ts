import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { describe, expect, it, vi } from "vite-plus/test";
import type { JobRecord } from "../ports/job-repository";
import { BackgroundJobsCoordinator } from "../services/background-jobs-coordinator";
import { createJobDispatcher, executeDeferredActions } from "../services/job-runtime";

function makeJob(id: string, type: string): JobRecord {
	const now = new Date();
	return {
		id,
		type,
		mediaSourceId: "source-1",
		status: "pending",
		payload: {},
		result: null,
		error: null,
		createdAt: now,
		updatedAt: now,
		parentId: null,
	};
}

describe("job-runtime", () => {
	it("dispatches each runnable job type to the matching processor", async () => {
		const processMedia = vi.fn(async () => undefined);
		const downloadImage = vi.fn(async () => undefined);
		const autoTagging = vi.fn(async () => undefined);
		const bulkDispatch = vi.fn(async () => undefined);
		const dispatcher = createJobDispatcher({
			processMedia,
			downloadImage,
			auto_tagging: autoTagging,
			bulk_tagging_dispatch: bulkDispatch,
		});

		await dispatcher(makeJob("job-1", "processMedia"));
		await dispatcher(makeJob("job-2", "downloadImage"));
		await dispatcher(makeJob("job-3", "auto_tagging"));
		await dispatcher(makeJob("job-4", "bulk_tagging_dispatch"));

		expect(processMedia).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1" }));
		expect(downloadImage).toHaveBeenCalledWith(expect.objectContaining({ id: "job-2" }));
		expect(autoTagging).toHaveBeenCalledWith(expect.objectContaining({ id: "job-3" }));
		expect(bulkDispatch).toHaveBeenCalledWith(expect.objectContaining({ id: "job-4" }));
	});

	it("enqueues deferred jobs and publishes deferred events", async () => {
		const create = vi.fn(async () => makeJob("created-1", "processMedia"));
		const publishEvent = vi.fn(async () => undefined);

		await executeDeferredActions(
			{
				jobs: [
					{
						mediaSourceId: "source-1",
						jobs: [
							{
								type: "processMedia",
								mediaId: "media-1",
								sourcePath: "/media",
								payload: { extra: true },
							},
						],
					},
				],
				sse: [
					{
						mediaSourceId: "source-1",
						event: "job-completed",
						payload: { ok: true },
					},
				],
			},
			{
				jobRepository: { create },
				publishEvent,
			},
		);

		expect(create).toHaveBeenCalledWith({
			type: "processMedia",
			mediaSourceId: "source-1",
			payload: {
				extra: true,
				mediaId: "media-1",
				sourcePath: "/media",
			},
		});
		expect(publishEvent).toHaveBeenCalledWith({
			mediaSourceId: "source-1",
			event: "job-completed",
			payload: { ok: true },
		});
	});
});

describe("BackgroundJobsCoordinator", () => {
	it("runs startup steps in the canonical order and applies config updates", async () => {
		const order: string[] = [];
		const config: AppConfig = {
			jobs: {
				concurrency: 3,
				aiConcurrency: 1,
				pollIntervalMs: 1000,
				enableAutoTagging: true,
			},
		} as AppConfig;
		const updateWorkerConfig = vi.fn(async () => {
			order.push("updateWorkerConfig");
		});
		const afterJobsQueued = vi.fn(async () => {
			order.push("afterJobsQueued");
		});

		const coordinator = new BackgroundJobsCoordinator({
			loadConfig: async () => {
				order.push("loadConfig");
				return config;
			},
			onConfigChange: (listener) => {
				order.push("onConfigChange");
				void listener(config);
			},
			updateWorkerConfig,
			resetRunnableJobs: async () => {
				order.push("resetRunnableJobs");
			},
			startWorker: () => {
				order.push("startWorker");
			},
			startWatchingAllSources: async () => {
				order.push("startWatchingAllSources");
			},
			performStartupChecks: async ({ afterJobsQueued: notify }) => {
				order.push("performStartupChecks");
				await notify(["source-1"]);
			},
			afterJobsQueued,
		});

		await coordinator.start();

		expect(order).toEqual([
			"loadConfig",
			"updateWorkerConfig",
			"onConfigChange",
			"updateWorkerConfig",
			"resetRunnableJobs",
			"startWorker",
			"startWatchingAllSources",
			"performStartupChecks",
			"afterJobsQueued",
		]);
		expect(updateWorkerConfig).toHaveBeenCalledTimes(2);
		expect(afterJobsQueued).toHaveBeenCalledWith(["source-1"]);
	});
});

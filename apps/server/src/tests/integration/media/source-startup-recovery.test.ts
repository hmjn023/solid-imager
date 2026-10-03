import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "~/infrastructure/db";
import { jobs, mediaSources, medias } from "~/infrastructure/db/schema";
import { FileWatcherManager } from "~/infrastructure/jobs/file-watcher-manager";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { services } from "~/infrastructure/service-registry";
import { MaintenanceService } from "~/infrastructure/services/maintenance-service";

vi.mock("~/infrastructure/jobs/file-watcher-manager", () => ({
	FileWatcherManager: { start: vi.fn(), stop: vi.fn() },
}));

const image = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

describe("interrupted source startup recovery", () => {
	let directory: string;
	let sourceId: string;

	beforeEach(async () => {
		// Let the initial bootstrap finish before simulating a second startup.
		await vi.waitFor(() =>
			expect(FileWatcherService.startMonitoringAll).toHaveBeenCalled(),
		);
		services.getJobWorker().stop();
		directory = await fs.mkdtemp(
			path.join(os.tmpdir(), "solid-imager-source-recovery-"),
		);
		await fs.mkdir(path.join(directory, "sub"));
		await fs.writeFile(path.join(directory, "registered.png"), image);
		await fs.writeFile(path.join(directory, "unregistered.png"), image);
		await fs.writeFile(path.join(directory, "sub", "unregistered.png"), image);
		const source = await services.getSourceRepository().create({
			name: "Interrupted source",
			description: null,
			type: "local",
			connectionInfo: { path: directory },
		});
		sourceId = source.id;
		await services
			.getSourceRepository()
			.update(sourceId, { syncStatus: "syncing" });
		// Simulate a process that stopped after committing just the first media row,
		// before even issuing its processMedia job.
		await services.getMediaRepository().create({
			mediaSourceId: sourceId,
			filePath: "registered.png",
			fileName: "registered.png",
			mediaType: "image",
			width: 1,
			height: 1,
			fileSize: image.byteLength,
			description: null,
			createdAt: new Date(),
			modifiedAt: new Date(),
		});
	});

	afterEach(async () => {
		if (sourceId) {
			await db.delete(jobs).where(eq(jobs.mediaSourceId, sourceId));
			await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
		}
		if (directory) await fs.rm(directory, { recursive: true, force: true });
	});

	it("restores missing media and jobs from disk during startup without duplicate registration", async () => {
		const maintenance = new MaintenanceService(
			services.getMediaRepository(),
			services.getJobRepository(),
			services.getSourceRepository(),
		);
		const resume = async () => {
			await FileWatcherService.startMonitoring(sourceId);
		};
		vi.mocked(FileWatcherService.startMonitoringAll).mockImplementationOnce(
			resume,
		);
		await maintenance.performStartupChecks();

		const records = await db
			.select()
			.from(medias)
			.where(eq(medias.mediaSourceId, sourceId));
		expect(records.map((record) => record.filePath).sort()).toEqual([
			"registered.png",
			"sub/unregistered.png",
			"unregistered.png",
		]);
		const queued = await db
			.select()
			.from(jobs)
			.where(eq(jobs.mediaSourceId, sourceId));
		for (const record of records) {
			const mediaJobs = queued.filter(
				(job) =>
					job.payload &&
					typeof job.payload === "object" &&
					"mediaId" in job.payload &&
					job.payload.mediaId === record.id,
			);
			expect(mediaJobs.length).toBeGreaterThanOrEqual(1);
			if (record.filePath !== "registered.png")
				expect(mediaJobs).toHaveLength(1);
		}
		expect(
			queued.every(
				(job) => job.type === "processMedia" && job.status === "pending",
			),
		).toBe(true);

		expect(
			(await services.getSourceRepository().findById(sourceId))?.syncStatus,
		).toBe("idle");
		expect(FileWatcherManager.start).toHaveBeenCalledWith(
			sourceId,
			directory,
			expect.any(Object),
		);

		await FileWatcherService.startMonitoring(sourceId);
		expect(
			await db.select().from(medias).where(eq(medias.mediaSourceId, sourceId)),
		).toHaveLength(3);
		expect(
			await db.select().from(jobs).where(eq(jobs.mediaSourceId, sourceId)),
		).toHaveLength(queued.length);
	});
});

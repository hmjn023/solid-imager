import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MediaSource } from "@solid-imager/core/sources";
import type { Media } from "@solid-imager/core/media";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DrizzleSourceRepository,
	MediaRepository,
} from "~/infrastructure/db/repositories";
import { DirectorySyncService } from "~/infrastructure/services/directory-sync-service";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { FileWatcherManager } from "~/infrastructure/jobs/file-watcher-manager";
import { MediaProcessingService } from "~/infrastructure/services/media-processing-service";

vi.mock("~/infrastructure/db/repositories", () => ({
	DrizzleSourceRepository: { findById: vi.fn(), update: vi.fn() },
	MediaRepository: {
		findAllPathsBySourceId: vi.fn(),
		findByPath: vi.fn(),
		delete: vi.fn(),
	},
}));
vi.mock("~/infrastructure/services/media-processing-service", () => ({
	MediaProcessingService: { registerAndProcess: vi.fn() },
}));
vi.mock("~/infrastructure/services/ccip-vector-service", () => ({
	ccipVectorService: { delete: vi.fn() },
}));
vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	deleteThumbnail: vi.fn(),
}));
vi.mock("~/infrastructure/storage/server-media-storage", () => ({
	ServerMediaStorage: {},
}));
vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishSource: vi.fn() },
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("~/infrastructure/service-registry", () => ({
	services: {
		getConfigService: () => ({
			getConfig: () => ({
				jobs: { concurrency: 1 },
				media: { supportedExtensions: { image: [".png"] } },
			}),
		}),
	},
}));

const sourceId = "11111111-1111-4111-8111-111111111111";
let directory: string;
let oldPath: string;
let newPath: string;
let currentSource: MediaSource | null;
const registered: Media[] = [];

function mediaRecord(id: string, filePath: string): Media {
	const now = new Date();
	return {
		id: filePath,
		mediaSourceId: id,
		filePath,
		fileName: filePath,
		mediaType: "image",
		width: 1,
		height: 1,
		fileSize: 1,
		description: null,
		createdAt: now,
		modifiedAt: now,
		indexedAt: now,
		status: "active",
	};
}

beforeEach(async () => {
	vi.clearAllMocks();
	vi.spyOn(FileWatcherManager, "start");
	registered.splice(0);
	directory = await fs.mkdtemp(
		path.join(os.tmpdir(), "solid-imager-watcher-path-"),
	);
	oldPath = path.join(directory, "old");
	newPath = path.join(directory, "new");
	await fs.mkdir(oldPath);
	await fs.mkdir(newPath);
	await fs.writeFile(path.join(newPath, "new-only.png"), "isolated fixture");
	currentSource = {
		id: sourceId,
		name: "source",
		description: null,
		type: "local",
		connectionInfo: { path: oldPath },
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	vi.mocked(DrizzleSourceRepository.findById).mockImplementation(
		async () => currentSource,
	);
	vi.mocked(DrizzleSourceRepository.update).mockImplementation(
		async (_id, update) => {
			if (!currentSource) throw new Error("Source removed");
			currentSource = { ...currentSource, ...update };
			return currentSource;
		},
	);
	vi.mocked(MediaRepository.findAllPathsBySourceId).mockImplementation(
		async () => [...registered],
	);
	vi.mocked(MediaRepository.findByPath).mockImplementation(
		async (_id, filePath) =>
			registered.find((record) => record.filePath === filePath) ?? null,
	);
	vi.mocked(MediaRepository.delete).mockImplementation(async (id) => {
		const index = registered.findIndex((record) => record.id === id);
		if (index >= 0) registered.splice(index, 1);
	});
	vi.mocked(MediaProcessingService.registerAndProcess).mockImplementation(
		async (id, filePath) => {
			const sourcePath =
				currentSource?.connectionInfo &&
				typeof currentSource.connectionInfo === "object" &&
				"path" in currentSource.connectionInfo
					? String(currentSource.connectionInfo.path)
					: "";
			await fs.access(path.join(sourcePath, filePath));
			const record = mediaRecord(id, filePath);
			registered.push(record);
			return record;
		},
	);
});
afterEach(async () => {
	await FileWatcherService.stopMonitoring(sourceId);
	vi.restoreAllMocks();
	await fs.rm(directory, { recursive: true, force: true });
});

function changeSourcePath(basePath: string) {
	if (!currentSource) throw new Error("Source removed");
	currentSource = { ...currentSource, connectionInfo: { path: basePath } };
}

function holdOldScan() {
	const original = fs.opendir.bind(fs);
	const scanning = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	const opened: string[] = [];
	vi.spyOn(fs, "opendir").mockImplementation(async (directoryPath, options) => {
		opened.push(String(directoryPath));
		if (String(directoryPath) === oldPath) {
			scanning.resolve();
			await release.promise;
		}
		return original(directoryPath, options);
	});
	return {
		scanning: scanning.promise,
		release: () => release.resolve(),
		opened,
	};
}

describe("real sync and watcher preparation after path edits", () => {
	it.each(["registration", "deletion"] as const)(
		"keeps monitoring later additions after one initial %s fails",
		async (failure) => {
			if (failure === "registration") {
				await fs.writeFile(path.join(oldPath, "broken.png"), "broken fixture");
				const register = vi
					.mocked(MediaProcessingService.registerAndProcess)
					.getMockImplementation();
				if (!register) throw new Error("Registration fixture is missing");
				vi.mocked(MediaProcessingService.registerAndProcess).mockImplementation(
					async (id, filePath, ...args) => {
						if (filePath === "broken.png") throw new Error("Invalid image");
						return register(id, filePath, ...args);
					},
				);
			} else {
				registered.push(mediaRecord(sourceId, "already-removed.png"));
				vi.mocked(MediaRepository.delete).mockRejectedValueOnce(
					new Error("Per-file deletion failure"),
				);
			}
			const sync = vi.spyOn(DirectorySyncService, "syncMediaSource");
			await FileWatcherService.startMonitoring(sourceId);
			await expect(sync.mock.results[0].value).resolves.toMatchObject({
				success: false,
				failureKind: "partial",
				failed: 1,
			});
			expect(currentSource?.syncStatus).toBe("error");
			const generation = vi.mocked(FileWatcherManager.start).mock.calls[0]?.[3];
			if (generation === undefined) throw new Error("Watcher did not start");
			expect(FileWatcherManager.isCurrentStart(sourceId, generation)).toBe(
				true,
			);
			await fs.writeFile(
				path.join(oldPath, "healthy-later.png"),
				"healthy fixture",
			);
			await vi.waitFor(
				() =>
					expect(registered.map((item) => item.filePath)).toContain(
						"healthy-later.png",
					),
				{ timeout: 5000 },
			);
		},
	);

	it("captures files added or removed immediately after the initial scan using a real watcher", async () => {
		await fs.writeFile(path.join(oldPath, "removed.png"), "fixture");
		registered.push(mediaRecord(sourceId, "removed.png"));
		const original =
			DirectorySyncService.syncMediaSource.bind(DirectorySyncService);
		vi.spyOn(DirectorySyncService, "syncMediaSource").mockImplementationOnce(
			async (id, scope) => {
				const result = await original(id, scope);
				// Previously this fell between the completed scan and chokidar.watch(),
				// whose ignoreInitial crawl suppressed late.png and missed the unlink.
				await fs.writeFile(path.join(oldPath, "late.png"), "fixture");
				await fs.unlink(path.join(oldPath, "removed.png"));
				return result;
			},
		);
		await FileWatcherService.startMonitoring(sourceId);
		await vi.waitFor(
			() =>
				expect(registered.map((item) => item.filePath)).toEqual(["late.png"]),
			{ timeout: 5000 },
		);
		expect(
			MediaProcessingService.registerAndProcess,
		).toHaveBeenCalledExactlyOnceWith(sourceId, "late.png");
		expect(MediaRepository.delete).toHaveBeenCalledExactlyOnceWith(
			"removed.png",
		);
	});

	it("rescans when a same-path predecessor is superseded before findById resolves", async () => {
		await fs.writeFile(path.join(oldPath, "existing.png"), "fixture");
		const finding = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const original =
			DirectorySyncService.syncMediaSource.bind(DirectorySyncService);
		vi.spyOn(DirectorySyncService, "syncMediaSource").mockImplementationOnce(
			(id, scope) => {
				vi.mocked(DrizzleSourceRepository.findById).mockImplementationOnce(
					async () => {
						finding.resolve();
						await release.promise;
						return currentSource;
					},
				);
				return original(id, scope);
			},
		);
		const first = FileWatcherService.startMonitoring(sourceId);
		await finding.promise;
		const replacement = FileWatcherService.startMonitoring(sourceId);
		await new Promise<void>((resolve) => setImmediate(resolve));
		release.resolve();
		await Promise.all([first, replacement]);
		expect(registered.map((item) => item.filePath)).toContain("existing.png");
	});

	it("scans the new path after its watcher is ready and older-path work finishes", async () => {
		const scan = holdOldScan();
		const first = FileWatcherService.startMonitoring(sourceId);
		await scan.scanning;
		changeSourcePath(newPath);
		const replacement = FileWatcherService.startMonitoring(sourceId);
		try {
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(scan.opened).toEqual([oldPath]);
			expect(FileWatcherManager.start).toHaveBeenCalledTimes(2);
		} finally {
			scan.release();
			await Promise.all([first, replacement]);
		}
		expect(scan.opened).toEqual([oldPath, newPath]);
		expect(
			MediaProcessingService.registerAndProcess,
		).toHaveBeenCalledExactlyOnceWith(sourceId, "new-only.png");
		expect(FileWatcherManager.start).toHaveBeenLastCalledWith(
			sourceId,
			newPath,
			expect.any(Object),
			expect.any(Number),
		);
		expect(
			vi.mocked(MediaProcessingService.registerAndProcess).mock
				.invocationCallOrder[0],
		).toBeGreaterThan(
			vi.mocked(FileWatcherManager.start).mock.invocationCallOrder[0],
		);
	});

	it("performs a fresh same-path scan after a replacement watcher becomes ready", async () => {
		const scan = holdOldScan();
		const first = FileWatcherService.startMonitoring(sourceId);
		await scan.scanning;
		const replacement = FileWatcherService.startMonitoring(sourceId);
		await new Promise<void>((resolve) => setImmediate(resolve));
		scan.release();
		await Promise.all([first, replacement]);
		expect(scan.opened).toEqual([oldPath, oldPath]);
		expect(FileWatcherManager.start).toHaveBeenLastCalledWith(
			sourceId,
			oldPath,
			expect.any(Object),
			expect.any(Number),
		);
	});

	it.each([false, true])(
		"does not start a queued new-path scan after stop (source deleted: %s)",
		async (deleted) => {
			const scan = holdOldScan();
			const first = FileWatcherService.startMonitoring(sourceId);
			await scan.scanning;
			changeSourcePath(newPath);
			const replacement = FileWatcherService.startMonitoring(sourceId);
			await new Promise<void>((resolve) => setImmediate(resolve));
			await FileWatcherService.stopMonitoring(sourceId);
			if (deleted) currentSource = null;
			scan.release();
			await Promise.all([first, replacement]);
			expect(scan.opened).toEqual([oldPath]);
			expect(MediaProcessingService.registerAndProcess).not.toHaveBeenCalled();
			expect(FileWatcherManager.start).toHaveBeenCalledTimes(2);
		},
	);

	it("keeps ordinary concurrent direct sync calls sharing their original source run", async () => {
		const scan = holdOldScan();
		const first = DirectorySyncService.syncMediaSource(sourceId);
		await scan.scanning;
		changeSourcePath(newPath);
		const shared = DirectorySyncService.syncMediaSource(sourceId);
		scan.release();
		const outcomes = await Promise.all([first, shared]);
		expect(outcomes[0]).toBe(outcomes[1]);
		expect(scan.opened).toEqual([oldPath]);
	});
});

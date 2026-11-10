import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MediaSource } from "@solid-imager/core/sources";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DrizzleSourceRepository,
	MediaRepository,
} from "~/infrastructure/db/repositories";
import { DirectorySyncService } from "~/infrastructure/services/directory-sync-service";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { FileWatcherManager } from "~/infrastructure/jobs/file-watcher-manager";
import { MediaProcessingService } from "~/infrastructure/services/media-processing-service";

vi.mock(
	"~/infrastructure/jobs/file-watcher-manager",
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import("~/infrastructure/jobs/file-watcher-manager")
			>();
		return {
			FileWatcherManager: { ...actual.FileWatcherManager, start: vi.fn() },
		};
	},
);
vi.mock("~/infrastructure/db/repositories", () => ({
	DrizzleSourceRepository: { findById: vi.fn(), update: vi.fn() },
	MediaRepository: { findAllPathsBySourceId: vi.fn(), delete: vi.fn() },
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
const registered: Array<{ id: string; filePath: string }> = [];

beforeEach(async () => {
	vi.clearAllMocks();
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
	vi.mocked(MediaProcessingService.registerAndProcess).mockImplementation(
		async (id, filePath) => {
			const sourcePath =
				currentSource?.connectionInfo &&
				typeof currentSource.connectionInfo === "object" &&
				"path" in currentSource.connectionInfo
					? String(currentSource.connectionInfo.path)
					: "";
			await fs.access(path.join(sourcePath, filePath));
			registered.push({ id: filePath, filePath });
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
	it("scans the new path's existing files before installing its ignore-initial watcher", async () => {
		const scan = holdOldScan();
		const first = FileWatcherService.startMonitoring(sourceId);
		await scan.scanning;
		changeSourcePath(newPath);
		const replacement = FileWatcherService.startMonitoring(sourceId);
		try {
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(scan.opened).toEqual([oldPath]);
			expect(FileWatcherManager.start).not.toHaveBeenCalled();
		} finally {
			scan.release();
			await Promise.all([first, replacement]);
		}
		expect(scan.opened).toEqual([oldPath, newPath]);
		expect(
			MediaProcessingService.registerAndProcess,
		).toHaveBeenCalledExactlyOnceWith(sourceId, "new-only.png");
		expect(FileWatcherManager.start).toHaveBeenCalledExactlyOnceWith(
			sourceId,
			newPath,
			expect.any(Object),
			expect.any(Number),
		);
		expect(
			vi.mocked(MediaProcessingService.registerAndProcess).mock
				.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(FileWatcherManager.start).mock.invocationCallOrder[0],
		);
	});

	it("shares an existing same-path scan between monitoring generations", async () => {
		const scan = holdOldScan();
		const first = FileWatcherService.startMonitoring(sourceId);
		await scan.scanning;
		const replacement = FileWatcherService.startMonitoring(sourceId);
		await new Promise<void>((resolve) => setImmediate(resolve));
		scan.release();
		await Promise.all([first, replacement]);
		expect(scan.opened).toEqual([oldPath]);
		expect(FileWatcherManager.start).toHaveBeenCalledExactlyOnceWith(
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
			expect(FileWatcherManager.start).not.toHaveBeenCalled();
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

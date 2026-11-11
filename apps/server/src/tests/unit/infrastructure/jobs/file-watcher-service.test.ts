import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileWatcherManager } from "~/infrastructure/jobs/file-watcher-manager";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import {
	DrizzleSourceRepository,
	MediaRepository,
} from "~/infrastructure/db/repositories";
import { DirectorySyncService } from "~/infrastructure/services/directory-sync-service";
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
	DrizzleSourceRepository: { findAll: vi.fn(), findById: vi.fn() },
	MediaRepository: { findByPath: vi.fn() },
}));
vi.mock("~/infrastructure/services/directory-sync-service", () => ({
	DirectorySyncService: { syncMediaSource: vi.fn() },
}));

vi.mock("~/infrastructure/services/media-processing-service", () => ({
	MediaProcessingService: { registerAndProcess: vi.fn() },
}));
vi.mock("~/infrastructure/services/ccip-vector-service", () => ({
	ccipVectorService: {},
}));
vi.mock("~/infrastructure/storage/server-media-storage", () => ({
	ServerMediaStorage: {},
}));
vi.mock("~/infrastructure/service-registry", () => ({ services: {} }));
vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: {},
}));
vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	deleteThumbnail: vi.fn(),
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function source(id: string, type: "local" | "s3" = "local") {
	return {
		id,
		name: id,
		description: null,
		type,
		connectionInfo: { path: `/source/${id}` },
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

function startedGeneration() {
	const generation = vi.mocked(FileWatcherManager.start).mock.calls[0]?.[3];
	if (generation === undefined)
		throw new Error("No watcher start was recorded");
	return generation;
}

describe("source monitoring on startup", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(FileWatcherManager.start).mockResolvedValue(true);
	});

	it("prepares watchers before rescanning local sources sequentially", async () => {
		const sources = [source("first"), source("remote", "s3"), source("second")];
		vi.mocked(DrizzleSourceRepository.findAll).mockResolvedValue(sources);
		vi.mocked(DrizzleSourceRepository.findById).mockImplementation(
			async (id) => sources.find((item) => item.id === id) ?? null,
		);
		let release!: () => void;
		let syncStarted!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const started = new Promise<void>((resolve) => {
			syncStarted = resolve;
		});
		vi.mocked(DirectorySyncService.syncMediaSource).mockImplementation(
			async (id) => {
				if (id === "first") {
					syncStarted();
					await gate;
				}
				return { sourceId: id, added: 7, deleted: 0, failed: 0, success: true };
			},
		);
		const startup = FileWatcherService.startMonitoringAll();
		try {
			await started;
			expect(DirectorySyncService.syncMediaSource).toHaveBeenCalledTimes(1);
			expect(FileWatcherManager.start).toHaveBeenCalledTimes(1);
		} finally {
			release();
		}
		await startup;
		expect(
			vi
				.mocked(DirectorySyncService.syncMediaSource)
				.mock.calls.map(([id]) => id),
		).toEqual(["first", "second"]);
		expect(FileWatcherManager.start).toHaveBeenCalledTimes(2);
		expect(FileWatcherManager.start).toHaveBeenNthCalledWith(
			1,
			"first",
			"/source/first",
			expect.any(Object),
			expect.any(Number),
		);
		expect(FileWatcherManager.start).toHaveBeenNthCalledWith(
			2,
			"second",
			"/source/second",
			expect.any(Object),
			expect.any(Number),
		);
	});

	it("continues restoring other sources when one source cannot be started", async () => {
		const sources = [source("first"), source("second")];
		vi.mocked(DrizzleSourceRepository.findAll).mockResolvedValue(sources);
		vi.mocked(DrizzleSourceRepository.findById).mockImplementation(
			async (id) => {
				if (id === "first") throw new Error("unavailable");
				return sources[1];
			},
		);
		vi.mocked(DirectorySyncService.syncMediaSource).mockResolvedValue({
			sourceId: "second",
			added: 2,
			deleted: 0,
			failed: 0,
			success: true,
		});
		await FileWatcherService.startMonitoringAll();
		expect(
			DirectorySyncService.syncMediaSource,
		).toHaveBeenCalledExactlyOnceWith(
			"second",
			expect.objectContaining({
				basePath: "/source/second",
				isCurrent: expect.any(Function),
			}),
		);
		expect(FileWatcherManager.start).toHaveBeenCalledExactlyOnceWith(
			"second",
			"/source/second",
			expect.any(Object),
			expect.any(Number),
		);
	});
});

describe("pending monitor requests", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(FileWatcherManager.start).mockResolvedValue(true);
	});

	it("buffers additions during the scan and deduplicates them against its committed registrations", async () => {
		const item = source("buffered-events");
		vi.mocked(DrizzleSourceRepository.findById).mockResolvedValue(item);
		const scanning = Promise.withResolvers<void>();
		const finish = Promise.withResolvers<void>();
		vi.mocked(DirectorySyncService.syncMediaSource).mockImplementationOnce(
			async () => {
				scanning.resolve();
				await finish.promise;
				return {
					sourceId: item.id,
					success: true,
					added: 1,
					deleted: 0,
					failed: 0,
				};
			},
		);
		const starting = FileWatcherService.startMonitoring(item.id);
		await scanning.promise;
		const callbacks = vi.mocked(FileWatcherManager.start).mock.calls[0][2];
		await callbacks.onAdd("scan-registered.png");
		await callbacks.onAdd("late.png");
		expect(MediaProcessingService.registerAndProcess).not.toHaveBeenCalled();
		vi.mocked(MediaRepository.findByPath)
			.mockResolvedValueOnce({
				id: "existing",
				mediaSourceId: item.id,
				fileName: "scan-registered.png",
				filePath: "scan-registered.png",
				mediaType: "image",
				width: 1,
				height: 1,
				fileSize: 1,
				description: null,
				createdAt: new Date(),
				modifiedAt: new Date(),
				indexedAt: new Date(),
				status: "active",
			})
			.mockResolvedValue(null);
		finish.resolve();
		await starting;
		expect(
			MediaProcessingService.registerAndProcess,
		).toHaveBeenCalledExactlyOnceWith(item.id, "late.png");
		await callbacks.onAdd("live.png");
		expect(MediaProcessingService.registerAndProcess).toHaveBeenLastCalledWith(
			item.id,
			"live.png",
		);
		await FileWatcherService.stopMonitoring(item.id);
	});

	it.each(["result", "throw"])(
		"closes a prepared watcher and discards events when sync fails via %s",
		async (failure) => {
			const item = source(`failed-sync-${failure}`);
			vi.mocked(DrizzleSourceRepository.findById).mockResolvedValue(item);
			vi.mocked(DirectorySyncService.syncMediaSource).mockImplementationOnce(
				async () => {
					await vi
						.mocked(FileWatcherManager.start)
						.mock.calls[0][2].onAdd("uncommitted.png");
					if (failure === "throw") throw new Error("failed sync");
					return {
						sourceId: item.id,
						success: false,
						added: 0,
						deleted: 0,
						failed: 1,
						error: "failed sync",
					};
				},
			);
			await FileWatcherService.startMonitoring(item.id);
			expect(MediaProcessingService.registerAndProcess).not.toHaveBeenCalled();
			const generation = startedGeneration();
			expect(FileWatcherManager.isCurrentStart(item.id, generation)).toBe(
				false,
			);
		},
	);

	it("does not scan when the watcher fails to become ready", async () => {
		const item = source("failed-ready");
		vi.mocked(DrizzleSourceRepository.findById).mockResolvedValue(item);
		vi.mocked(FileWatcherManager.start).mockResolvedValueOnce(false);
		await FileWatcherService.startMonitoring(item.id);
		expect(DirectorySyncService.syncMediaSource).not.toHaveBeenCalled();
		expect(
			FileWatcherManager.isCurrentStart(item.id, startedGeneration()),
		).toBe(false);
	});

	it("does not recreate a watcher after stop completes during the initial scan", async () => {
		const item = source("stop-during-sync");
		vi.mocked(DrizzleSourceRepository.findById).mockResolvedValue(item);
		const scan =
			Promise.withResolvers<
				Awaited<ReturnType<typeof DirectorySyncService.syncMediaSource>>
			>();
		vi.mocked(DirectorySyncService.syncMediaSource).mockReturnValueOnce(
			scan.promise,
		);
		const starting = FileWatcherService.startMonitoring(item.id);
		await vi.waitFor(() =>
			expect(DirectorySyncService.syncMediaSource).toHaveBeenCalled(),
		);
		await FileWatcherService.stopMonitoring(item.id);
		scan.resolve({
			sourceId: item.id,
			success: true,
			added: 0,
			deleted: 0,
			failed: 0,
		});
		await starting;
		expect(FileWatcherManager.start).toHaveBeenCalledTimes(1);
		expect(
			FileWatcherManager.isCurrentStart(item.id, startedGeneration()),
		).toBe(false);
	});

	it("closes a prepared watcher when the source is deleted before scanning", async () => {
		const item = source("deleted-during-sync");
		vi.mocked(DrizzleSourceRepository.findById)
			.mockResolvedValueOnce(item)
			.mockResolvedValueOnce(null);
		vi.mocked(DirectorySyncService.syncMediaSource).mockResolvedValueOnce({
			sourceId: item.id,
			success: true,
			added: 0,
			deleted: 0,
			failed: 0,
		});
		await FileWatcherService.startMonitoring(item.id);
		expect(DirectorySyncService.syncMediaSource).not.toHaveBeenCalled();
		expect(
			FileWatcherManager.isCurrentStart(item.id, startedGeneration()),
		).toBe(false);
	});

	it("ignores an earlier scan completion after a new start chooses another path", async () => {
		const item = source("reconfigure-during-sync");
		vi.mocked(DrizzleSourceRepository.findById).mockResolvedValue(item);
		const scan =
			Promise.withResolvers<
				Awaited<ReturnType<typeof DirectorySyncService.syncMediaSource>>
			>();
		vi.mocked(DirectorySyncService.syncMediaSource)
			.mockReturnValueOnce(scan.promise)
			.mockResolvedValue({
				sourceId: item.id,
				success: true,
				added: 0,
				deleted: 0,
				failed: 0,
			});
		const first = FileWatcherService.startMonitoring(item.id);
		await vi.waitFor(() =>
			expect(DirectorySyncService.syncMediaSource).toHaveBeenCalled(),
		);
		vi.mocked(DrizzleSourceRepository.findById).mockResolvedValue({
			...item,
			connectionInfo: { path: "/new-path" },
		});
		await FileWatcherService.startMonitoring(item.id);
		scan.resolve({
			sourceId: item.id,
			success: true,
			added: 0,
			deleted: 0,
			failed: 0,
		});
		await first;
		expect(FileWatcherManager.start).toHaveBeenCalledTimes(2);
		expect(FileWatcherManager.start).toHaveBeenLastCalledWith(
			item.id,
			"/new-path",
			expect.any(Object),
			expect.any(Number),
		);
	});
});

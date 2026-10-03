import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileWatcherManager } from "~/infrastructure/jobs/file-watcher-manager";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { DirectorySyncService } from "~/infrastructure/services/directory-sync-service";

vi.mock("~/infrastructure/jobs/file-watcher-manager", () => ({
	FileWatcherManager: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock("~/infrastructure/repositories/source-repository", () => ({
	DrizzleSourceRepository: { findAll: vi.fn(), findById: vi.fn() },
}));
vi.mock("~/infrastructure/services/directory-sync-service", () => ({
	DirectorySyncService: { syncMediaSource: vi.fn() },
}));
vi.mock("~/infrastructure/repositories/media-repository", () => ({
	MediaRepository: {},
}));
vi.mock("~/infrastructure/services/media-processing-service", () => ({
	MediaProcessingService: {},
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

describe("source monitoring on startup", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("rescans local sources sequentially before starting their watchers", async () => {
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
				return { sourceId: id, added: 7, deleted: 0 };
			},
		);
		const startup = FileWatcherService.startMonitoringAll();
		try {
			await started;
			expect(DirectorySyncService.syncMediaSource).toHaveBeenCalledTimes(1);
			expect(FileWatcherManager.start).not.toHaveBeenCalled();
		} finally {
			release();
		}
		await startup;
		expect(vi.mocked(DirectorySyncService.syncMediaSource).mock.calls).toEqual([
			["first"],
			["second"],
		]);
		expect(FileWatcherManager.start).toHaveBeenCalledTimes(2);
		expect(FileWatcherManager.start).toHaveBeenNthCalledWith(
			1,
			"first",
			"/source/first",
			expect.any(Object),
		);
		expect(FileWatcherManager.start).toHaveBeenNthCalledWith(
			2,
			"second",
			"/source/second",
			expect.any(Object),
		);
	});

	it("continues restoring other sources when one source cannot be started", async () => {
		const sources = [source("first"), source("second")];
		vi.mocked(DrizzleSourceRepository.findAll).mockResolvedValue(sources);
		vi.mocked(DrizzleSourceRepository.findById)
			.mockRejectedValueOnce(new Error("unavailable"))
			.mockResolvedValueOnce(sources[1]);
		vi.mocked(DirectorySyncService.syncMediaSource).mockResolvedValue({
			sourceId: "second",
			added: 2,
			deleted: 0,
		});
		await FileWatcherService.startMonitoringAll();
		expect(
			DirectorySyncService.syncMediaSource,
		).toHaveBeenCalledExactlyOnceWith("second");
		expect(FileWatcherManager.start).toHaveBeenCalledExactlyOnceWith(
			"second",
			"/source/second",
			expect.any(Object),
		);
	});
});

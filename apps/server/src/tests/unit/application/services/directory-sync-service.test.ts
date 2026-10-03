import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks
vi.mock("~/infrastructure/logger", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}));

vi.mock("node:fs/promises", () => ({
	default: {
		access: vi.fn(),
		opendir: vi.fn(async (directoryPath: string) => {
			const names = directoryPath.endsWith("/sub")
				? [["file2.png", "file"]]
				: [
						["file1.jpg", "file"],
						["sub", "directory"],
						["new_file.mp3", "file"],
					];
			return {
				async *[Symbol.asyncIterator]() {
					for (const [name, type] of names) {
						yield {
							name,
							isDirectory: () => type === "directory",
							isFile: () => type === "file",
						};
					}
				},
			};
		}),
	},
}));

vi.mock("~/infrastructure/repositories/media-repository", () => ({
	MediaRepository: {
		findAllPathsBySourceId: vi.fn().mockResolvedValue([
			{ id: "id1", filePath: "file1.jpg" },
			{ id: "id2", filePath: "sub/file2.png" },
			{ id: "id3", filePath: "file_to_delete.mp4" },
		]),
		delete: vi.fn(),
	},
}));

vi.mock("~/infrastructure/repositories/source-repository", () => ({
	DrizzleSourceRepository: {
		findById: vi.fn().mockResolvedValue({
			id: "source-1",
			type: "local",
			connectionInfo: { path: "/fake/path" },
		}),
		findAll: vi.fn().mockResolvedValue([]),
		update: vi.fn().mockResolvedValue(undefined),
	},
}));
vi.mock("~/infrastructure/services/media-processing-service", () => ({
	MediaProcessingService: {
		registerAndProcess: vi.fn(),
	},
}));

vi.mock("~/infrastructure/services/ccip-vector-service", () => ({
	ccipVectorService: { delete: vi.fn() },
}));

vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	deleteThumbnail: vi.fn(),
}));

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: {
		publishSource: vi.fn(),
	},
}));

vi.mock("~/infrastructure/service-registry", () => ({
	services: {
		getConfigService: vi.fn().mockReturnValue({
			getConfig: vi.fn().mockReturnValue({
				jobs: { concurrency: 5 },
				media: {
					supportedExtensions: {
						image: [".jpg", ".png"],
						video: [".mp4"],
						audio: [".mp3"],
					},
				},
			}),
		}),
	},
}));

import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { MediaProcessingService } from "~/infrastructure/services/media-processing-service";

describe("DirectorySyncService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("syncMediaSource", () => {
		it("should process additions and deletions correctly", async () => {
			const mediaSourceId = "source-1";

			const { DirectorySyncService } =
				await import("~/infrastructure/services/directory-sync-service");

			// Execute
			const result = await DirectorySyncService.syncMediaSource(mediaSourceId);

			// Verify diff calculation
			expect(result.added).toBe(1);
			expect(result.deleted).toBe(1);

			// Verify addition
			expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledTimes(
				1,
			);
			expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledWith(
				mediaSourceId,
				"new_file.mp3",
			);

			// Verify deletion
			expect(MediaRepository.delete).toHaveBeenCalledTimes(1);
			expect(MediaRepository.delete).toHaveBeenCalledWith("id3");
		});

		it("coalesces concurrent syncs for the same source", async () => {
			const mediaSourceId = "source-1";
			const { DirectorySyncService } =
				await import("~/infrastructure/services/directory-sync-service");
			let resolveProcessing: (() => void) | undefined;
			let resolveStarted: (() => void) | undefined;
			const started = new Promise<void>((resolve) => {
				resolveStarted = resolve;
			});
			const processing = new Promise<void>((resolve) => {
				resolveProcessing = resolve;
			});
			vi.mocked(
				MediaProcessingService.registerAndProcess,
			).mockImplementationOnce(async () => {
				resolveStarted?.();
				await processing;
				const now = new Date();
				return {
					id: "media-new",
					mediaSourceId,
					filePath: "new_file.mp3",
					fileName: "new_file.mp3",
					mediaType: "audio",
					width: 0,
					height: 0,
					fileSize: null,
					description: null,
					createdAt: now,
					modifiedAt: now,
					indexedAt: now,
					status: "active",
				};
			});

			const first = DirectorySyncService.syncMediaSource(mediaSourceId);
			await started;
			const second = DirectorySyncService.syncMediaSource(mediaSourceId);

			expect(DrizzleSourceRepository.findById).toHaveBeenCalledTimes(1);
			resolveProcessing?.();
			await expect(Promise.all([first, second])).resolves.toHaveLength(2);
		});

		it("publishes a safe message when sync fails", async () => {
			const { DirectorySyncService } =
				await import("~/infrastructure/services/directory-sync-service");
			vi.mocked(MediaRepository.findAllPathsBySourceId).mockRejectedValueOnce(
				new Error("/secret/source-path and password=secret"),
			);

			await DirectorySyncService.syncMediaSource("source-1");

			expect(RealtimeEventBus.publishSource).toHaveBeenCalledWith(
				"source-1",
				"source-sync-status",
				expect.objectContaining({
					message: "Directory sync failed",
					status: "error",
				}),
			);
		});
	});
});

function directoryWithFiles(count: number, onRead: () => void = () => {}) {
	return {
		async *[Symbol.asyncIterator]() {
			for (let i = 0; i < count; i++) {
				onRead();
				yield {
					name: `image-${i}.jpg`,
					isDirectory: () => false,
					isFile: () => true,
				};
			}
		},
	} as Awaited<ReturnType<typeof fs.opendir>>;
}

function mediaRecord(mediaSourceId: string, filePath: string) {
	const now = new Date();
	return {
		id: filePath,
		mediaSourceId,
		filePath,
		fileName: filePath,
		mediaType: "image" as const,
		width: 1,
		height: 1,
		fileSize: 1,
		description: null,
		createdAt: now,
		modifiedAt: now,
		indexedAt: now,
		status: "active" as const,
	};
}

describe("large source sync and recovery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(MediaProcessingService.registerAndProcess).mockReset();
		vi.mocked(MediaRepository.delete).mockReset();
	});

	it("reads and registers only five files at a time while completing all additions", async () => {
		const count = 115_894;
		let scanned = 0;
		vi.mocked(fs.opendir).mockResolvedValueOnce(
			directoryWithFiles(count, () => {
				scanned++;
			}),
		);
		vi.mocked(MediaRepository.findAllPathsBySourceId).mockResolvedValueOnce([]);
		let release!: () => void;
		let batchStarted!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const started = new Promise<void>((resolve) => {
			batchStarted = resolve;
		});
		let active = 0;
		let peak = 0;
		vi.mocked(MediaProcessingService.registerAndProcess).mockImplementation(
			async (sourceId, filePath) => {
				active++;
				peak = Math.max(peak, active);
				if (active === 5) batchStarted();
				await gate;
				active--;
				return mediaRecord(sourceId, filePath);
			},
		);
		const { DirectorySyncService } =
			await import("~/infrastructure/services/directory-sync-service");
		const sync = DirectorySyncService.syncMediaSource("large-source");
		try {
			await started;
			expect(active).toBe(5);
			expect(scanned).toBe(5);
			expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledTimes(
				5,
			);
		} finally {
			release();
		}
		await expect(sync).resolves.toMatchObject({ added: count, deleted: 0 });
		expect(peak).toBe(5);
		expect(scanned).toBe(count);
	});

	it("honors a configured job concurrency below five for registration", async () => {
		const { services } = await import("~/infrastructure/service-registry");
		const config = services.getConfigService().getConfig();
		vi.mocked(services.getConfigService().getConfig).mockReturnValueOnce({
			...config,
			jobs: { ...config.jobs, concurrency: 2 },
		});
		vi.mocked(fs.opendir).mockResolvedValueOnce(directoryWithFiles(12));
		vi.mocked(MediaRepository.findAllPathsBySourceId).mockResolvedValueOnce([]);
		let active = 0;
		let peak = 0;
		vi.mocked(MediaProcessingService.registerAndProcess).mockImplementation(
			async (sourceId, filePath) => {
				active++;
				peak = Math.max(peak, active);
				await new Promise<void>((resolve) => setImmediate(resolve));
				active--;
				return mediaRecord(sourceId, filePath);
			},
		);
		const { DirectorySyncService } =
			await import("~/infrastructure/services/directory-sync-service");
		await expect(
			DirectorySyncService.syncMediaSource("two-worker-source"),
		).resolves.toMatchObject({ added: 12 });
		expect(peak).toBe(2);
	});

	it("bounds deletion concurrency as well", async () => {
		const count = 2048;
		vi.mocked(fs.opendir).mockResolvedValueOnce(directoryWithFiles(0));
		vi.mocked(MediaRepository.findAllPathsBySourceId).mockResolvedValueOnce(
			Array.from({ length: count }, (_, i) => ({
				id: `id-${i}`,
				filePath: `image-${i}.jpg`,
			})),
		);
		let active = 0;
		let peak = 0;
		vi.mocked(MediaRepository.delete).mockImplementation(async () => {
			active++;
			peak = Math.max(peak, active);
			await new Promise<void>((resolve) => setImmediate(resolve));
			active--;
		});
		const { DirectorySyncService } =
			await import("~/infrastructure/services/directory-sync-service");
		await expect(
			DirectorySyncService.syncMediaSource("large-delete-source"),
		).resolves.toMatchObject({ added: 0, deleted: count });
		expect(peak).toBe(5);
	});

	it("recovers previously unregistered files on a fresh sync without registering existing files again", async () => {
		const registered = new Map<string, string>();
		let interrupted = true;
		vi.mocked(fs.opendir)
			.mockResolvedValueOnce(directoryWithFiles(12))
			.mockResolvedValueOnce(directoryWithFiles(12));
		vi.mocked(MediaRepository.findAllPathsBySourceId).mockImplementation(
			async () =>
				Array.from(registered, ([filePath, id]) => ({ id, filePath })),
		);
		vi.mocked(MediaProcessingService.registerAndProcess).mockImplementation(
			async (sourceId, filePath) => {
				if (interrupted && Number(filePath.match(/image-(\d+)/)?.[1]) >= 5)
					throw new Error("simulated interruption");
				registered.set(filePath, filePath);
				return mediaRecord(sourceId, filePath);
			},
		);
		const first =
			await import("~/infrastructure/services/directory-sync-service");
		await expect(
			first.DirectorySyncService.syncMediaSource("interrupted-source"),
		).resolves.toMatchObject({ added: 5 });
		expect(first.getSourceSyncState("interrupted-source")).toBe("error");
		expect(DrizzleSourceRepository.update).toHaveBeenLastCalledWith(
			"interrupted-source",
			expect.objectContaining({ syncStatus: "error" }),
		);
		interrupted = false;
		vi.resetModules();
		vi.mocked(MediaProcessingService.registerAndProcess).mockClear();
		const restarted =
			await import("~/infrastructure/services/directory-sync-service");
		await expect(
			restarted.DirectorySyncService.syncMediaSource("interrupted-source"),
		).resolves.toMatchObject({ added: 7, deleted: 0 });
		expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledTimes(7);
		expect(registered.size).toBe(12);
		expect(restarted.getSourceSyncState("interrupted-source")).toBe("idle");
	});

	it("does not delete existing records when a subtree cannot be fully scanned", async () => {
		vi.mocked(MediaRepository.findAllPathsBySourceId).mockResolvedValueOnce([
			{ id: "existing", filePath: "sub/existing.jpg" },
		]);
		vi.mocked(fs.opendir)
			.mockResolvedValueOnce({
				async *[Symbol.asyncIterator]() {
					yield { name: "sub", isDirectory: () => true, isFile: () => false };
				},
			} as Awaited<ReturnType<typeof fs.opendir>>)
			.mockRejectedValueOnce(new Error("EACCES"));
		const { DirectorySyncService, getSourceSyncState } =
			await import("~/infrastructure/services/directory-sync-service");
		await DirectorySyncService.syncMediaSource("unreadable-source");
		expect(MediaRepository.delete).not.toHaveBeenCalled();
		expect(getSourceSyncState("unreadable-source")).toBe("error");
	});
});

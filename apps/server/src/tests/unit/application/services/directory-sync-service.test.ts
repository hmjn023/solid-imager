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
		readdir: vi.fn(async (directoryPath: string) => {
			const names = directoryPath.endsWith("/sub")
				? [["file2.png", "file"]]
				: [
						["file1.jpg", "file"],
						["sub", "directory"],
						["new_file.mp3", "file"],
					];
			return names.map(([name, type]) => ({
				name,
				isDirectory: () => type === "directory",
				isFile: () => type === "file",
			}));
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
	},
}));
vi.mock("~/application/services/media-processing-service", () => ({
	MediaProcessingService: {
		registerAndProcess: vi.fn(),
	},
}));

vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	deleteThumbnail: vi.fn(),
}));

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: {
		publishSource: vi.fn(),
	},
}));

vi.mock("~/application/registry", () => ({
	services: {
		getConfigService: vi.fn().mockReturnValue({
			getConfig: vi.fn().mockReturnValue({
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

import { MediaProcessingService } from "~/application/services/media-processing-service";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";

describe("DirectorySyncService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("syncMediaSource", () => {
		it("should process additions and deletions correctly", async () => {
			const mediaSourceId = "source-1";

			const { DirectorySyncService } = await import(
				"~/application/services/directory-sync-service"
			);

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
			const { DirectorySyncService } = await import(
				"~/application/services/directory-sync-service"
			);
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
			const { DirectorySyncService } = await import(
				"~/application/services/directory-sync-service"
			);
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

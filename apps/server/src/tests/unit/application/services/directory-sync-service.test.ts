import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// Mocks
vi.mock("~/infrastructure/logger", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

vi.mock("node:fs/promises", () => ({
	default: {
		access: vi.fn(),
	},
}));

vi.mock("bun", () => ({
	Glob: class {
		scan() {
			return {
				async *[Symbol.asyncIterator]() {
					yield "file1.jpg";
					yield "sub/file2.png";
					yield "new_file.mp3";
				},
			};
		}
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

vi.mock("~/infrastructure/jobs/sse-manager", () => ({
	SseManager: {
		sendEvent: vi.fn(),
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
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

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
	});
});

import fs from "node:fs/promises";
import ffmpeg from "fluent-ffmpeg";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openBunImage } from "~/infrastructure/processing/bun-image";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

// Mock definitions
vi.mock("node:fs/promises");
vi.mock("fluent-ffmpeg");
vi.mock("~/infrastructure/processing/bun-image");

describe("ServerMediaStorage Unit Tests", () => {
	const basePath = "/tmp/test-storage";
	const ExpectedWidth = 800;

	beforeEach(() => {
		vi.resetAllMocks();

		// Setup default mocks using vi.mocked checks for type safety if needed,
		// or just casting for convenience in this simple test file.

		// Mock Bun.Image to return an object with metadata method
		const mockBunImage = {
			metadata: vi
				.fn()
				.mockResolvedValue({ width: ExpectedWidth, height: 600 }),
		};
		vi.mocked(openBunImage).mockReturnValue(
			mockBunImage as unknown as ReturnType<typeof openBunImage>,
		);

		// Mock fluent-ffmpeg
		// fluent-ffmpeg default export is a function that returns an object (command)
		// but explicit ffprobe usage: ffmpeg.ffprobe(path, cb)
		vi.mocked(ffmpeg).ffprobe = vi.fn((_path: string, cb: any) => {
			cb(null, {
				streams: [{ codec_type: "video", width: 1920, height: 1080 }],
				format: { duration: 60 },
			});
		}) as any;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("copyFile", () => {
		it("should succeed for video files using ffmpeg", async () => {
			// Setup
			const sourcePath = "/source/video.mp4";
			const targetPath = basePath;

			// 1. Existence check (fails -> not exists)
			vi.mocked(fs.stat).mockRejectedValueOnce({ code: "ENOENT" });

			// 2. Metadata extraction stats (in getFileMetadata)
			vi.mocked(fs.stat).mockResolvedValueOnce({
				size: 2048,
				birthtime: new Date(),
				mtime: new Date(),
				isDirectory: () => false,
				isFile: () => true,
			} as any);

			// Execute
			const result = await ServerMediaStorage.copyFile(
				sourcePath,
				targetPath,
				{},
			);

			// Verify
			expect(result).toBeDefined();
			expect(ffmpeg.ffprobe).toHaveBeenCalled();
			// Bun.Image should NOT be called for video files
			expect(openBunImage).not.toHaveBeenCalled();
		});

		it("should succeed for image files using Bun.Image", async () => {
			// Setup
			const sourcePath = "/source/image.png";
			const targetPath = basePath;

			// 1. Existence check (fails -> not exists)
			vi.mocked(fs.stat).mockRejectedValueOnce({ code: "ENOENT" });

			// 2. Metadata extraction stats (succeeds)
			vi.mocked(fs.stat).mockResolvedValueOnce({
				size: 1024,
				birthtime: new Date(),
				mtime: new Date(),
				isDirectory: () => false,
				isFile: () => true,
			} as any);

			// Execute
			const result = await ServerMediaStorage.copyFile(
				sourcePath,
				targetPath,
				{},
			);

			// Verify
			expect(result).toBeDefined();
			expect(openBunImage).toHaveBeenCalledWith("/tmp/test-storage/image.png");
			expect(result.width).toBe(ExpectedWidth);
		});
	});

	describe("saveFile", () => {
		it("should succeed for video files using ffmpeg", async () => {
			// Setup
			const file = new File(["dummy content"], "video.mp4", {
				type: "video/mp4",
			});

			// 1. Existence check (fails -> not exists)
			vi.mocked(fs.stat).mockRejectedValueOnce({ code: "ENOENT" });

			// 2. Metadata extraction stats
			vi.mocked(fs.stat).mockResolvedValueOnce({
				size: 2048,
				birthtime: new Date(),
				mtime: new Date(),
				isDirectory: () => false,
				isFile: () => true,
			} as any);

			// Execute & Verify
			const result = await ServerMediaStorage.saveFile(basePath, file, {});

			expect(result).toBeDefined();
			expect(ffmpeg.ffprobe).toHaveBeenCalled();
			expect(openBunImage).not.toHaveBeenCalled();
		});
	});
});

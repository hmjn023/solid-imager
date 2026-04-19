import fs from "node:fs/promises";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

// Mock definitions
vi.mock("node:fs/promises");
vi.mock("sharp");
vi.mock("fluent-ffmpeg");

describe("ServerMediaStorage Unit Tests", () => {
	const basePath = "/tmp/test-storage";
	const ExpectedWidth = 800;

	beforeEach(() => {
		vi.resetAllMocks();

		// Setup default mocks using vi.mocked checks for type safety if needed,
		// or just casting for convenience in this simple test file.

		// Mock sharp to return an object with metadata method
		const mockSharpInstance = {
			metadata: vi.fn().mockResolvedValue({ width: ExpectedWidth, height: 600 }),
		};
		// @ts-expect-error - Mocking default export function behavior
		vi.mocked(sharp).mockReturnValue(mockSharpInstance);

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
			const result = await ServerMediaStorage.copyFile(sourcePath, targetPath, {});

			// Verify
			expect(result).toBeDefined();
			expect(ffmpeg.ffprobe).toHaveBeenCalled();
			// Sharp should NOT be called for video files
			expect(sharp).not.toHaveBeenCalled();
		});

		it("should succeed for image files using sharp", async () => {
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
			const result = await ServerMediaStorage.copyFile(sourcePath, targetPath, {});

			// Verify
			expect(result).toBeDefined();
			expect(sharp).toHaveBeenCalled();
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
			expect(sharp).not.toHaveBeenCalled();
		});
	});
});

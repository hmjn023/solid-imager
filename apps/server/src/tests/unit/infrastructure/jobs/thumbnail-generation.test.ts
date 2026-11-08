import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	thumbnailDir: "",
	generateThumbnail: vi.fn(),
	findMedia: vi.fn(),
	findSource: vi.fn(),
}));

vi.mock("~/infrastructure/processing/image-processor", () => ({
	ImageProcessor: { generateThumbnail: mocks.generateThumbnail },
}));
vi.mock("~/infrastructure/db/repositories", () => ({
	MediaRepository: { findById: mocks.findMedia },
	DrizzleSourceRepository: { findById: mocks.findSource },
}));
vi.mock("~/infrastructure/service-registry", () => ({
	services: {
		getConfigService: () => ({
			getConfig: () => ({
				storage: {
					thumbnailDir: mocks.thumbnailDir,
					thumbnailSize: 512,
					thumbnailQuality: 80,
				},
			}),
		}),
	},
}));
vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishJob: vi.fn() },
}));

import {
	generateThumbnailForMedia,
	getThumbnailPath,
} from "~/infrastructure/jobs/thumbnails";

const mediaSourceId = "11111111-1111-4111-8111-111111111111";
const mediaId = "22222222-2222-4222-8222-222222222222";
const sourceTimestamp = new Date("2026-01-01T00:00:00.123Z");
const cachedTimestamp = new Date("2025-01-01T00:00:00.456Z");

describe("thumbnail generation publication", () => {
	let directory: string;
	let inputPath: string;
	let outputPath: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		directory = await fs.mkdtemp(path.join(tmpdir(), "thumbnail-generation-"));
		const sourcePath = path.join(directory, "source");
		mocks.thumbnailDir = path.join(directory, "thumbnails");
		await fs.mkdir(sourcePath);
		inputPath = path.join(sourcePath, "video.mp4");
		await fs.writeFile(inputPath, "original video");
		await fs.utimes(inputPath, sourceTimestamp, sourceTimestamp);
		outputPath = getThumbnailPath(mediaSourceId, mediaId, 512);
		await fs.mkdir(path.dirname(outputPath), { recursive: true });
		await fs.writeFile(outputPath, "previous thumbnail");
		await fs.utimes(outputPath, cachedTimestamp, cachedTimestamp);
		mocks.findSource.mockResolvedValue({
			id: mediaSourceId,
			type: "local",
			connectionInfo: { path: sourcePath },
		});
		mocks.findMedia.mockResolvedValue({
			id: mediaId,
			mediaSourceId,
			filePath: "video.mp4",
			mediaType: "video",
		});
		mocks.generateThumbnail.mockReset();
	});

	afterEach(async () => {
		await fs.rm(directory, { recursive: true, force: true });
	});

	async function expectOriginalPreserved() {
		expect(await fs.readFile(outputPath, "utf8")).toBe("previous thumbnail");
		expect((await fs.stat(outputPath)).mtime.getTime()).toBe(
			cachedTimestamp.getTime(),
		);
		expect(await fs.readdir(path.dirname(outputPath))).toEqual([
			`${mediaId}.webp`,
		]);
	}

	it("publishes a complete thumbnail with the source timestamp and no temporary files", async () => {
		mocks.generateThumbnail.mockImplementation(
			async (
				input: string,
				temporaryPath: string,
				size: number,
				quality: number,
			) => {
				expect(input).toBe(inputPath);
				expect(temporaryPath).not.toBe(outputPath);
				expect(path.dirname(temporaryPath)).toBe(path.dirname(outputPath));
				expect(path.extname(temporaryPath)).toBe(".webp");
				expect(size).toBe(512);
				expect(quality).toBe(80);
				await fs.writeFile(temporaryPath, "partial");
				expect(await fs.readFile(outputPath, "utf8")).toBe(
					"previous thumbnail",
				);
				await fs.writeFile(temporaryPath, "complete thumbnail");
			},
		);

		await generateThumbnailForMedia(mediaSourceId, mediaId, 512);

		expect(await fs.readFile(outputPath, "utf8")).toBe("complete thumbnail");
		const output = await fs.stat(outputPath);
		expect(output.mtime.getTime()).toBe(sourceTimestamp.getTime());
		expect(output.mtimeMs).toBeGreaterThanOrEqual(sourceTimestamp.getTime());
		expect(await fs.readdir(path.dirname(outputPath))).toEqual([
			`${mediaId}.webp`,
		]);
	});

	it("preserves the cached thumbnail and removes partial output when generation fails", async () => {
		mocks.generateThumbnail.mockImplementation(
			async (_input: string, temporaryPath: string) => {
				await fs.writeFile(temporaryPath, "partial thumbnail");
				throw new Error("FFmpeg failed");
			},
		);

		await expect(
			generateThumbnailForMedia(mediaSourceId, mediaId, 512),
		).rejects.toThrow("FFmpeg failed");

		await expectOriginalPreserved();
	});

	it("preserves the cached thumbnail if the video changes during generation", async () => {
		mocks.generateThumbnail.mockImplementation(
			async (_input: string, temporaryPath: string) => {
				await fs.writeFile(temporaryPath, "thumbnail from the old video");
				await fs.appendFile(inputPath, " modified during generation");
			},
		);

		await expect(
			generateThumbnailForMedia(mediaSourceId, mediaId, 512),
		).rejects.toThrow("Media changed during thumbnail generation");

		await expectOriginalPreserved();
	});

	it("rejects a replaced video even when its size and modification time are preserved", async () => {
		const original = await fs.stat(inputPath);
		mocks.generateThumbnail.mockImplementation(
			async (_input: string, temporaryPath: string) => {
				await fs.writeFile(temporaryPath, "thumbnail from the old video");
				const replacementPath = path.join(directory, "replacement.mp4");
				await fs.writeFile(replacementPath, "replaced video");
				await fs.utimes(replacementPath, original.atime, original.mtime);
				await fs.rename(replacementPath, inputPath);
				const replaced = await fs.stat(inputPath);
				expect(replaced.size).toBe(original.size);
				expect(replaced.mtimeMs).toBe(original.mtimeMs);
				expect(replaced.ino).not.toBe(original.ino);
			},
		);

		await expect(
			generateThumbnailForMedia(mediaSourceId, mediaId, 512),
		).rejects.toThrow("Media changed during thumbnail generation");

		await expectOriginalPreserved();
	});
});

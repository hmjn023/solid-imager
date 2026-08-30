import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalImageProcessor } from "~/infrastructure/processing/image-processor";

const IMAGE_WIDTH = 12;
const IMAGE_HEIGHT = 8;

describe("LocalImageProcessor image format fallback", () => {
	let tempDirectory: string;
	const imageProcessor = new LocalImageProcessor();

	beforeEach(async () => {
		tempDirectory = await fs.mkdtemp(
			path.join(os.tmpdir(), "solid-imager-image-processor-"),
		);
		vi.spyOn(Bun, "file").mockImplementation(() => {
			throw new Error("Bun.Image cannot decode this format");
		});
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await fs.rm(tempDirectory, { recursive: true, force: true });
	});

	async function createFixture(extension: ".svg" | ".tiff") {
		const inputPath = path.join(tempDirectory, `input${extension}`);
		if (extension === ".svg") {
			await fs.writeFile(
				inputPath,
				`<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}"><rect width="100%" height="100%" fill="red"/></svg>`,
			);
		} else {
			await sharp({
				create: {
					width: IMAGE_WIDTH,
					height: IMAGE_HEIGHT,
					channels: 3,
					background: { r: 255, g: 0, b: 0 },
				},
			})
				.tiff()
				.toFile(inputPath);
		}
		return inputPath;
	}

	it.each([".svg", ".tiff"] as const)(
		"uses sharp fallback for %s dimensions and thumbnails",
		async (extension) => {
			const inputPath = await createFixture(extension);
			const outputPath = path.join(tempDirectory, "thumbnail.webp");

			await expect(imageProcessor.getDimensions(inputPath)).resolves.toEqual({
				width: IMAGE_WIDTH,
				height: IMAGE_HEIGHT,
			});

			await imageProcessor.generateThumbnail(
				inputPath,
				outputPath,
				IMAGE_WIDTH,
				80,
			);

			const outputMetadata = await sharp(outputPath).metadata();
			expect(outputMetadata.format).toBe("webp");
			expect(outputMetadata.width).toBe(IMAGE_WIDTH);
			expect(outputMetadata.height).toBe(IMAGE_HEIGHT);
		},
	);
});

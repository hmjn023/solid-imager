import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

const IMAGE_WIDTH = 12;
const IMAGE_HEIGHT = 8;

describe.each([".svg", ".tiff"] as const)(
	"ServerMediaStorage format fallback (%s)",
	(extension) => {
		let tempDirectory: string;

		beforeEach(async () => {
			tempDirectory = await fs.mkdtemp(
				path.join(os.tmpdir(), "solid-imager-storage-"),
			);
			const originalBunFile = Bun.file;
			vi.spyOn(Bun, "file").mockImplementation((input) => {
				const file = originalBunFile(input);
				file.image = () => {
					throw new Error("Bun.Image cannot decode this format");
				};
				return file;
			});
		});

		afterEach(async () => {
			vi.restoreAllMocks();
			await fs.rm(tempDirectory, { recursive: true, force: true });
		});

		async function createFixture(fileName: string, directory = tempDirectory) {
			const filePath = path.join(directory, fileName);
			if (extension === ".svg") {
				await fs.writeFile(
					filePath,
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
					.toFile(filePath);
			}
			return filePath;
		}

		it("retains uploaded files after sharp metadata fallback", async () => {
			const fileName = `uploaded${extension}`;
			const sourceDirectory = path.join(tempDirectory, "source");
			await fs.mkdir(sourceDirectory);
			const sourcePath = await createFixture(fileName, sourceDirectory);
			const file = new File([await fs.readFile(sourcePath)], fileName);

			const result = await ServerMediaStorage.saveFile(tempDirectory, file, {});

			expect(result.width).toBe(IMAGE_WIDTH);
			expect(result.height).toBe(IMAGE_HEIGHT);
			expect(
				(await fs.stat(path.join(tempDirectory, result.filePath))).isFile(),
			).toBe(true);
		});

		it("retains copied files after sharp metadata fallback", async () => {
			const sourcePath = await createFixture(`source${extension}`);
			const targetDirectory = path.join(tempDirectory, "target");
			await fs.mkdir(targetDirectory);

			const result = await ServerMediaStorage.copyFile(
				sourcePath,
				targetDirectory,
				{},
			);

			expect(result.width).toBe(IMAGE_WIDTH);
			expect(result.height).toBe(IMAGE_HEIGHT);
			expect(
				(await fs.stat(path.join(targetDirectory, result.fileName))).isFile(),
			).toBe(true);
		});
	},
);

import fs from "node:fs/promises";
import path from "node:path";
import type {
	IMediaStorage,
	MediaMetadata,
	MediaStorageResult,
} from "@solid-imager/core";
import type { conflictSchema } from "@solid-imager/core/domain/media/upload-schemas";
import sharp from "sharp";
import type { z } from "zod";

/**
 * Resolves a path safely, ensuring it remains within the base path.
 * Prevents path traversal attacks.
 */
const resolveSafePath = (basePath: string, targetPath: string): string => {
	const resolvedPath = path.resolve(basePath, targetPath);
	const absoluteBase = path.resolve(basePath);

	if (
		resolvedPath !== absoluteBase &&
		!resolvedPath.startsWith(absoluteBase + path.sep)
	) {
		throw new Error(`Invalid path: ${targetPath}`);
	}
	return resolvedPath;
};

export const ServerMediaStorage: IMediaStorage = {
	async saveFile(
		basePath: string,
		file: { name: string; arrayBuffer(): Promise<ArrayBuffer | Uint8Array> },
		options: {
			filename?: string;
			overwrite?: boolean;
			autoIncrement?: boolean;
		},
	): Promise<MediaStorageResult> {
		const uploadRequest = options;
		let targetFileName = uploadRequest.filename || file.name;

		let targetFilePath = resolveSafePath(basePath, targetFileName);
		let relativeFilePath = path.relative(basePath, targetFilePath);
		let conflict: z.infer<typeof conflictSchema> | undefined;

		// Handle file name conflicts
		let counter = 0;
		while (
			await fs
				.stat(targetFilePath)
				.then(() => true)
				.catch(() => false)
		) {
			if (uploadRequest.overwrite) {
				break; // Overwrite existing file
			}

			if (!uploadRequest.autoIncrement) {
				conflict = {
					existingFile: relativeFilePath,
					suggestedName: "",
				};
				throw new Error("File already exists and overwrite is not allowed.");
			}

			counter++;
			const ext = path.extname(file.name);
			const base = path.basename(file.name, ext);
			targetFileName = `${base}_${counter}${ext}`;
			targetFilePath = resolveSafePath(basePath, targetFileName);
			relativeFilePath = path.relative(basePath, targetFilePath);
			conflict = {
				existingFile: path.relative(
					basePath,
					resolveSafePath(basePath, uploadRequest.filename || file.name),
				),
				suggestedName: targetFileName,
			};
		}

		// Save the file
		const arrayBuffer = await file.arrayBuffer();
		await fs.writeFile(targetFilePath, new Uint8Array(arrayBuffer));

		// Extract valid metadata using getFileMetadata to support both images and videos
		try {
			const metadata = await ServerMediaStorage.getFileMetadata(targetFilePath);

			return {
				filePath: relativeFilePath,
				fileName: targetFileName,
				width: metadata.width,
				height: metadata.height,
				size: metadata.size,
				createdAt: metadata.createdAt,
				modifiedAt: metadata.modifiedAt,
				conflict,
			};
		} catch (e) {
			try {
				await fs.unlink(targetFilePath);
			} catch (_) {
				/* ignore unlink error */
			}
			throw e;
		}
	},

	async deleteFile(basePath: string, filePath: string): Promise<void> {
		const fullPath = resolveSafePath(basePath, filePath);

		// Check if exists
		try {
			await fs.unlink(fullPath);
		} catch (error: unknown) {
			// biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
			if ((error as any).code === "ENOENT") {
				return; // Already deleted
			}
			throw error;
		}
	},

	async getFile(basePath: string, filePath: string): Promise<Uint8Array> {
		const fullPath = resolveSafePath(basePath, filePath);
		return await fs.readFile(fullPath);
	},

	async scanDirectory(basePath: string): Promise<string[]> {
		const files: string[] = [];
		const queue: string[] = [basePath];

		while (queue.length > 0) {
			const dir = queue.shift();
			if (!dir) {
				continue;
			}

			try {
				const dirents = await fs.readdir(dir, { withFileTypes: true });
				for (const dirent of dirents) {
					const res = path.resolve(dir, dirent.name);
					if (dirent.isDirectory()) {
						queue.push(res);
					} else {
						files.push(res);
					}
				}
			} catch (_e) {
				// Ignore errors
			}
		}

		return files;
	},

	async getFileMetadata(fullPath: string): Promise<MediaMetadata> {
		const stats = await fs.stat(fullPath);
		const ext = path.extname(fullPath).toLowerCase();

		// Video formats
		if ([".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(ext)) {
			const { getFfmpeg } = await import("~/infrastructure/utils/ffmpeg");
			const ffmpeg = getFfmpeg();

			return new Promise<MediaMetadata & { duration?: number }>(
				(resolve, reject) => {
					ffmpeg.ffprobe(fullPath, (err, videoData) => {
						if (err) {
							reject(
								new Error(
									`Could not extract video metadata for ${fullPath}: ${err.message}`,
								),
							);
							return;
						}

						// Find video stream
						const videoStream = videoData.streams.find(
							(s) => s.codec_type === "video",
						);
						if (!(videoStream?.width && videoStream?.height)) {
							reject(
								new Error(
									`No video stream found or missing dimensions for ${fullPath}`,
								),
							);
							return;
						}

						resolve({
							width: videoStream.width,
							height: videoStream.height,
							size: stats.size,
							createdAt: stats.birthtime,
							modifiedAt: stats.mtime,
							duration: videoData.format.duration,
						});
					});
				},
			);
		}

		// Audio formats
		if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) {
			return {
				width: 0,
				height: 0,
				size: stats.size,
				createdAt: stats.birthtime,
				modifiedAt: stats.mtime,
			};
		}

		// Image formats
		const metadata = await sharp(fullPath).metadata();

		if (!(metadata.width && metadata.height)) {
			throw new Error(`Could not extract media dimensions for ${fullPath}`);
		}

		return {
			width: metadata.width,
			height: metadata.height,
			size: stats.size,
			createdAt: stats.birthtime,
			modifiedAt: stats.mtime,
		};
	},

	async copyFile(
		sourcePath: string,
		targetBasePath: string,
		options: {
			filename?: string;
			overwrite?: boolean;
			autoIncrement?: boolean;
		},
	): Promise<MediaStorageResult> {
		const uploadRequest = options;
		const sourceFileName = path.basename(sourcePath);
		let targetFileName = uploadRequest.filename || sourceFileName;

		let targetFilePath = resolveSafePath(targetBasePath, targetFileName);
		let relativeFilePath = path.relative(targetBasePath, targetFilePath);
		let conflict: z.infer<typeof conflictSchema> | undefined;

		// Handle file name conflicts
		let counter = 0;
		while (
			await fs
				.stat(targetFilePath)
				.then(() => true)
				.catch(() => false)
		) {
			if (uploadRequest.overwrite) {
				break; // Overwrite existing file
			}

			if (!uploadRequest.autoIncrement) {
				conflict = {
					existingFile: relativeFilePath,
					suggestedName: "",
				};
				throw new Error("File already exists and overwrite is not allowed.");
			}

			counter++;
			const ext = path.extname(sourceFileName);
			const base = path.basename(sourceFileName, ext);
			targetFileName = `${base}_${counter}${ext}`;
			targetFilePath = resolveSafePath(targetBasePath, targetFileName);
			relativeFilePath = path.relative(targetBasePath, targetFilePath);
			conflict = {
				existingFile: path.relative(
					targetBasePath,
					resolveSafePath(
						targetBasePath,
						uploadRequest.filename || sourceFileName,
					),
				),
				suggestedName: targetFileName,
			};
		}

		// Copy the file
		await fs.copyFile(sourcePath, targetFilePath);

		// Extract metadata using getFileMetadata
		try {
			// Use ServerMediaStorage.getFileMetadata to support video files as well
			const metadata = await ServerMediaStorage.getFileMetadata(targetFilePath);

			return {
				filePath: relativeFilePath,
				fileName: targetFileName,
				width: metadata.width,
				height: metadata.height,
				size: metadata.size,
				createdAt: metadata.createdAt,
				modifiedAt: metadata.modifiedAt,
				conflict,
			};
		} catch (e) {
			try {
				await fs.unlink(targetFilePath);
			} catch (_) {
				// Ignore error if temporary file cleanup fails
			}
			throw e;
		}
	},
};

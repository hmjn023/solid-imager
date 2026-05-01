import fs from "node:fs/promises";
import path from "node:path";
import type { MediaPathAdapter } from "@solid-imager/application/services/media-service";
import {
	buildMediaStorageResult,
	resolveSafePath,
	withCleanup,
} from "@solid-imager/application/services/media-storage-utils";
import { resolveUploadTargetPath } from "@solid-imager/application/services/media-upload-utils";
import type {
	IMediaStorage,
	MediaMetadata,
	MediaStorageResult,
} from "@solid-imager/core";
import sharp from "sharp";

const pathAdapter: MediaPathAdapter = {
	join: path.join,
	extname: path.extname,
	basename: path.basename,
	relative: path.relative,
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
		const resolved = await resolveUploadTargetPath(
			basePath,
			uploadRequest.filename || file.name,
			uploadRequest.overwrite ?? false,
			uploadRequest.autoIncrement ?? false,
			{
				pathAdapter,
				exists: async (p) => {
					try {
						await fs.stat(p);
						return true;
					} catch {
						return false;
					}
				},
			},
		);

		const targetFilePath = resolved.fullPath;
		const relativeFilePath = resolved.relativePath;
		const targetFileName = path.basename(targetFilePath);
		const conflict = resolved.conflict;

		// Save the file
		const arrayBuffer = await file.arrayBuffer();
		await fs.writeFile(targetFilePath, new Uint8Array(arrayBuffer));

		// Extract valid metadata using getFileMetadata to support both images and videos
		return await withCleanup(
			async () => {
				const metadata =
					await ServerMediaStorage.getFileMetadata(targetFilePath);
				return buildMediaStorageResult(
					metadata,
					relativeFilePath,
					targetFileName,
					conflict,
				);
			},
			async () => {
				await fs.unlink(targetFilePath);
			},
		);
	},

	async deleteFile(basePath: string, filePath: string): Promise<void> {
		const fullPath = resolveSafePath(basePath, filePath);

		// Check if exists
		try {
			await fs.unlink(fullPath);
		} catch (error: unknown) {
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

		const resolved = await resolveUploadTargetPath(
			targetBasePath,
			uploadRequest.filename || sourceFileName,
			uploadRequest.overwrite ?? false,
			uploadRequest.autoIncrement ?? false,
			{
				pathAdapter,
				exists: async (p) => {
					try {
						await fs.stat(p);
						return true;
					} catch {
						return false;
					}
				},
			},
		);

		const targetFilePath = resolved.fullPath;
		const relativeFilePath = resolved.relativePath;
		const targetFileName = path.basename(targetFilePath);
		const conflict = resolved.conflict;

		// Copy the file
		await fs.copyFile(sourcePath, targetFilePath);

		// Extract metadata using getFileMetadata
		return await withCleanup(
			async () => {
				// Use ServerMediaStorage.getFileMetadata to support video files as well
				const metadata =
					await ServerMediaStorage.getFileMetadata(targetFilePath);
				return buildMediaStorageResult(
					metadata,
					relativeFilePath,
					targetFileName,
					conflict,
				);
			},
			async () => {
				await fs.unlink(targetFilePath);
			},
		);
	},
};

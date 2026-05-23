import { updateMediaContextMetadata } from "@solid-imager/application/services/media-context-metadata";

import {
	createMediaService,
	type MediaPathAdapter,
} from "@solid-imager/application/services/media-service";
import {
	buildMediaStorageResult,
	resolveSafePath,
	withCleanup,
} from "@solid-imager/application/services/media-storage-utils";
import {
	normalizeRelativePath,
	resolveUploadTargetPath,
} from "@solid-imager/application/services/media-upload-utils";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	MediaDetails,
	MediaSearchRequest,
	MediaSearchResponse,
	UpdateMediaRequest,
} from "@solid-imager/core/domain/media/schemas";
import type {
	UploadMediaRequest,
	UploadResponse,
} from "@solid-imager/core/domain/media/upload-schemas";
import { uploadMediaRequestSchema } from "@solid-imager/core/domain/media/upload-schemas";
import type {
	IMediaStorage,
	MediaMetadata,
	MediaSourceFile,
	MediaStorageResult,
} from "@solid-imager/core/interfaces/media-storage";
import { getTauriAppServices } from "~/app-services";
import { basename, dirname, extname, joinLocalPath } from "../../path-utils";
import { TauriAuthorRepository } from "../repositories/author-repository";
import { TauriCharacterRepository } from "../repositories/character-repository";
import { TauriIpRepository } from "../repositories/ip-repository";
import { TauriMediaRepository } from "../repositories/media-repository";
import { TauriProjectRepository } from "../repositories/project-repository";
import { TauriSourceRepository } from "../repositories/source-repository";
import { TauriTagRepository } from "../repositories/tag-repository";

const MAX_FILENAME_COLLISION_ATTEMPTS = 1000;

type ProbeMediaResult = {
	width: number;
	height: number;
	size: number;
	createdAt: string;
	modifiedAt: string;
	duration?: number | null;
	mimeType?: string | null;
	codec?: string | null;
};

async function probeMedia(fullPath: string): Promise<ProbeMediaResult> {
	return await getTauriAppServices().commandClient.invoke<ProbeMediaResult>(
		"probe_media",
		{
			mediaPath: fullPath,
		},
	);
}

async function ensureParentDirectory(fullPath: string) {
	const parentDir = dirname(fullPath);
	if (parentDir !== "/") {
		await getTauriAppServices().fileSystem.mkdir(parentDir, {
			recursive: true,
		});
	}
}

const tauriPathAdapter: MediaPathAdapter = {
	extname,
	basename,
	join: joinLocalPath,
	relative(basePath: string, fullPath: string) {
		const normalizedBase = basePath.replace(/[\\/]+$/, "");
		if (fullPath.startsWith(`${normalizedBase}/`)) {
			return normalizeRelativePath(fullPath.slice(normalizedBase.length + 1));
		}
		if (fullPath.startsWith(`${normalizedBase}\\`)) {
			return normalizeRelativePath(fullPath.slice(normalizedBase.length + 1));
		}
		return normalizeRelativePath(fullPath);
	},
};

const tauriMediaStorage: IMediaStorage = {
	async saveFile(
		basePath: string,
		file: MediaSourceFile,
		options: {
			filename?: string;
			overwrite?: boolean;
			autoIncrement?: boolean;
		},
	): Promise<MediaStorageResult> {
		const requestedPath = options.filename?.trim() || file.name;
		if (!requestedPath) {
			throw new Error("Filename is required");
		}
		const target = await resolveUploadTargetPath(
			basePath,
			requestedPath,
			options.overwrite ?? false,
			options.autoIncrement ?? false,
			{
				pathAdapter: tauriPathAdapter,
				exists: (p) => getTauriAppServices().fileSystem.exists(p),
				maxAttempts: MAX_FILENAME_COLLISION_ATTEMPTS,
			},
		);
		await ensureParentDirectory(target.fullPath);
		const buffer = await file.arrayBuffer();
		await getTauriAppServices().fileSystem.writeFile(
			target.fullPath,
			new Uint8Array(buffer),
		);

		return await withCleanup(
			async () => {
				const metadata = await this.getFileMetadata(target.fullPath);
				return buildMediaStorageResult(
					metadata,
					target.relativePath,
					basename(target.relativePath),
					target.conflict,
				);
			},
			async () => {
				await getTauriAppServices().fileSystem.rm(target.fullPath, {
					force: true,
				});
			},
		);
	},

	async deleteFile(basePath: string, filePath: string): Promise<void> {
		const safePath = resolveSafePath(basePath, filePath);
		await getTauriAppServices().fileSystem.rm(safePath, {
			force: true,
		});
	},

	async getFile(basePath: string, filePath: string): Promise<Uint8Array> {
		const safePath = resolveSafePath(basePath, filePath);
		return await getTauriAppServices().fileSystem.readFile(safePath);
	},

	async scanDirectory(basePath: string): Promise<string[]> {
		const entries = await getTauriAppServices().fileSystem.scanDirectoryRecursive(basePath);
		return entries
			.filter((entry) => !entry.isDirectory)
			.map((entry) => entry.fullPath);
	},

	async getFileMetadata(fullPath: string): Promise<MediaMetadata> {
		const probe = await probeMedia(fullPath);
		return {
			width: probe.width,
			height: probe.height,
			size: probe.size,
			createdAt: new Date(probe.createdAt),
			modifiedAt: new Date(probe.modifiedAt),
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
		const target = await resolveUploadTargetPath(
			targetBasePath,
			options.filename || basename(sourcePath),
			options.overwrite ?? false,
			options.autoIncrement ?? false,
			{
				pathAdapter: tauriPathAdapter,
				exists: (p) => getTauriAppServices().fileSystem.exists(p),
				maxAttempts: MAX_FILENAME_COLLISION_ATTEMPTS,
			},
		);
		await ensureParentDirectory(target.fullPath);
		await getTauriAppServices().fileSystem.copyFile(
			sourcePath,
			target.fullPath,
		);

		return await withCleanup(
			async () => {
				const metadata = await this.getFileMetadata(target.fullPath);
				return buildMediaStorageResult(
					metadata,
					target.relativePath,
					basename(target.relativePath),
					target.conflict,
				);
			},
			async () => {
				await getTauriAppServices().fileSystem.rm(target.fullPath, {
					force: true,
				});
			},
		);
	},
};

const mediaService = createMediaService({
	mediaRepository: TauriMediaRepository,
	sourceRepository: TauriSourceRepository,
	storageService: tauriMediaStorage,
	tagRepository: TauriTagRepository,
	imageProcessor: {
		async generateThumbnail(mediaPath, outputPath, size, quality) {
			await getTauriAppServices().imageProcessor.generateThumbnail(
				mediaPath,
				outputPath,
				size,
				quality,
			);
		},
		async extractMetadata(mediaPath) {
			return await getTauriAppServices().imageProcessor.extractMetadata(
				mediaPath,
			);
		},
		async getDimensions(mediaPath) {
			return await getTauriAppServices().imageProcessor.getDimensions(
				mediaPath,
			);
		},
	},
	authorRepository: TauriAuthorRepository,
	projectRepository: TauriProjectRepository,
	characterRepository: TauriCharacterRepository,
	ipRepository: TauriIpRepository,
	transactionManager: {
		async transaction<T>(
			callback: (tx: Transaction) => Promise<T>,
		): Promise<T> {
			return await getTauriAppServices().db.transaction(callback);
		},
	},
	contextMetadataUpdater: async (mediaId, context, tx) => {
		await updateMediaContextMetadata(
			mediaId,
			context as Partial<
				import("@solid-imager/core/domain/media/schemas").MediaMetadataContext
			>,
			{
				mediaRepository: TauriMediaRepository,
				authorRepository: TauriAuthorRepository,
				characterRepository: TauriCharacterRepository,
				ipRepository: TauriIpRepository,
				projectRepository: TauriProjectRepository,
				tagRepository: TauriTagRepository,
			},
			tx,
		);
	},
	pathAdapter: tauriPathAdapter,
});

function bytesToMediaSourceFile(
	bytes: number[],
	filename: string,
): MediaSourceFile {
	return {
		name: filename,
		async arrayBuffer() {
			return new Uint8Array(bytes);
		},
	};
}

export const TauriMediaService = {
	async searchMedia(
		sourceId: string | undefined | null,
		params: MediaSearchRequest,
	): Promise<MediaSearchResponse> {
		return await mediaService.searchMedia(sourceId, params);
	},

	async getMediaDetails(
		sourceId: string,
		mediaId: string,
	): Promise<MediaDetails> {
		return await mediaService.getMediaDetails(sourceId, mediaId);
	},

	async uploadMedia(
		sourceId: string,
		bytes: number[],
		options: {
			filename?: string;
			description?: string;
			sourceUrl?: string;
			overwrite?: UploadMediaRequest["overwrite"];
			autoIncrement?: UploadMediaRequest["autoIncrement"];
		},
	): Promise<UploadResponse> {
		const uploadRequest = uploadMediaRequestSchema.parse(options);
		const filename = uploadRequest.filename?.trim();
		if (!filename) {
			throw new Error("Filename is required");
		}
		return await mediaService.uploadMedia(
			sourceId,
			bytesToMediaSourceFile(bytes, filename),
			uploadRequest,
		);
	},

	async updateMedia(
		sourceId: string,
		mediaId: string,
		updates: UpdateMediaRequest,
	) {
		return await mediaService.updateMedia(sourceId, mediaId, updates);
	},

	async deleteMedia(sourceId: string, mediaId: string): Promise<void> {
		await mediaService.deleteMedia(sourceId, mediaId);
	},

	async copyMedia(
		_mediaSourceId: string,
		mediaId: string,
		targetSourceId: string,
	) {
		await mediaService.copyMedia(mediaId, targetSourceId);
	},

	async moveMedia(
		_mediaSourceId: string,
		mediaId: string,
		targetSourceId: string,
	) {
		await mediaService.moveMedia(mediaId, targetSourceId);
	},
};

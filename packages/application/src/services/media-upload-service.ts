import path from "node:path";
import type { TransactionManager } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { IMediaStorage } from "@solid-imager/core";
import type { MediaStorageResult } from "@solid-imager/core";
import {
	MediaFileConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import {
	type AddMediaRequest,
	mediaSourceIdSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	type UploadMediaRequest,
	type UploadResponse,
	uploadMediaRequestSchema,
} from "@solid-imager/core/domain/media/upload-schemas";
import { getMediaTypeFromExtension } from "@solid-imager/core/domain/media/utils/media-type-utils";
import type { IMediaProcessingService } from "../ports/media-processing-service";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";

const SIGNATURES: Record<string, Buffer> = {
	png: Buffer.from("89504e470d0a1a0a", "hex"),
	jpg: Buffer.from("ffd8ff", "hex"),
	jpeg: Buffer.from("ffd8ff", "hex"),
	gif: Buffer.from("47494638", "hex"),
	webp: Buffer.from("52494646", "hex"), // RIFF
	mp4: Buffer.from("66747970", "hex"), // ftyp
	webm: Buffer.from("1a45dfa3", "hex"),
	mp3: Buffer.from("494433", "hex"), // ID3
	wav: Buffer.from("52494646", "hex"), // RIFF
};

const WEBP_SUBTYPE = Buffer.from("57454250", "hex"); // WEBP
const FILE_HEADER_BYTES = 12;
const WEBP_OFFSET = 8;
const WEBP_END = 12;

export async function validateFileSignature(
	file: File,
	filename: string,
): Promise<void> {
	const ext = path.extname(filename).toLowerCase().replace(".", "");
	const buffer = await file.slice(0, FILE_HEADER_BYTES).arrayBuffer();
	const bytes = new Uint8Array(buffer);

	if (ext in SIGNATURES) {
		const sig = SIGNATURES[ext];
		if (sig && !bytes.subarray(0, sig.length).every((b, i) => b === sig[i])) {
			throw new Error(`File signature mismatch for .${ext}`);
		}
	}

	if (
		ext === "webp" &&
		!bytes
			.subarray(WEBP_OFFSET, WEBP_END)
			.every((b, i) => b === WEBP_SUBTYPE[i])
	) {
		throw new Error("Invalid WEBP signature (missing WEBP)");
	}
}

export class MediaUploadService {
	constructor(
		private readonly mediaRepository: IMediaRepository,
		private readonly sourceRepository: SourceRepository,
		private readonly storageService: IMediaStorage,
		private readonly processing: Pick<
			IMediaProcessingService,
			"requestProcessing"
		>,
		private readonly transactionManager: TransactionManager,
	) {}

	async uploadMedia(
		mediaSourceId: string,
		file: File,
		options: UploadMediaRequest,
	): Promise<UploadResponse> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const mediaSource = await this.sourceRepository.findById(validatedSourceId);

		if (!mediaSource) {
			throw new ResourceNotFoundError("Media Source", validatedSourceId);
		}

		if (mediaSource.type !== "local") {
			throw new Error(
				"Only local media sources are supported for uploads in Phase 1.",
			);
		}

		const connectionInfo = localConnectionSchema.parse(
			mediaSource.connectionInfo,
		);
		const basePath = connectionInfo.path;

		const uploadRequest = uploadMediaRequestSchema.parse(options);

		await validateFileSignature(file, uploadRequest.filename ?? file.name);

		let fileInfo: MediaStorageResult;
		try {
			fileInfo = await this.storageService.saveFile(basePath, file, {
				filename: uploadRequest.filename,
				overwrite: uploadRequest.overwrite,
				autoIncrement: uploadRequest.autoIncrement,
			});
		} catch (error) {
			if (error instanceof MediaFileConflictError) {
				return {
					success: false,
					filePath: error.filePath,
					conflict: {
						existingFile: error.filePath,
						suggestedName: "",
					},
				};
			}
			throw error;
		}

		const mediaType = getMediaTypeFromExtension(fileInfo.fileName);

		const newMedia: AddMediaRequest = {
			mediaSourceId: validatedSourceId,
			filePath: fileInfo.filePath,
			fileName: fileInfo.fileName,
			mediaType,
			description: uploadRequest.description || null,
			width: fileInfo.width,
			height: fileInfo.height,
			fileSize: fileInfo.size,
			createdAt: fileInfo.createdAt,
			modifiedAt: fileInfo.modifiedAt,
		};

		try {
			await this.transactionManager.transaction(async (tx) => {
				const insertedMedia = await this.mediaRepository.upsert(newMedia, tx);
				if (uploadRequest.sourceUrl) {
					await this.mediaRepository.addUrls(
						insertedMedia.id,
						[uploadRequest.sourceUrl],
						tx,
					);
				}
				await this.processing.requestProcessing(
					insertedMedia,
					basePath,
					{},
					tx,
				);
			});
		} catch (error) {
			// An overwritten file may already belong to a registered media; never delete it.
			if (!uploadRequest.overwrite) {
				try {
					await this.storageService.deleteFile(basePath, fileInfo.filePath);
				} catch {
					/* Preserve the registration error. */
				}
			}
			throw error;
		}

		return {
			success: true,
			filePath: fileInfo.filePath,
			conflict: fileInfo.conflict as
				| { existingFile: string; suggestedName: string }
				| undefined,
		};
	}

	async registerExistingMedia(mediaSourceId: string, directoryPath: string) {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const files = await this.storageService.scanDirectory(directoryPath);
		const failures: unknown[] = [];
		for (const file of files) {
			try {
				const relativePath = path.relative(directoryPath, file);
				const existing = await this.mediaRepository.findByPath(
					validatedSourceId,
					relativePath,
				);
				if (existing) continue;
				const metadata = await this.storageService.getFileMetadata(file);
				await this.transactionManager.transaction(async (tx) => {
					const created = await this.mediaRepository.upsert(
						{
							mediaSourceId: validatedSourceId,
							filePath: relativePath,
							fileName: path.basename(file),
							mediaType: getMediaTypeFromExtension(file),
							width: metadata.width,
							height: metadata.height,
							fileSize: metadata.size,
							createdAt: metadata.createdAt,
							modifiedAt: metadata.modifiedAt,
							description: null,
						},
						tx,
					);
					await this.processing.requestProcessing(
						created,
						directoryPath,
						{},
						tx,
					);
				});
			} catch (error) {
				failures.push(error);
			}
		}
		if (failures.length > 0)
			throw new AggregateError(failures, "Some media could not be registered");
	}
}

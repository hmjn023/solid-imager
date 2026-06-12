import path from "node:path";
import type { IMediaStorage } from "@solid-imager/core";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import {
	type AddMediaRequest,
	type Media,
	mediaSourceIdSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	type UploadMediaRequest,
	type UploadResponse,
	uploadMediaRequestSchema,
} from "@solid-imager/core/domain/media/upload-schemas";
import { getMediaTypeFromExtension } from "@solid-imager/core/domain/media/utils/media-type-utils";
import type { IJobRepository } from "@solid-imager/core/domain/repositories/job-repository";
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
		private readonly jobRepo: IJobRepository,
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

		const fileInfo = await this.storageService.saveFile(basePath, file, {
			filename: uploadRequest.filename,
			overwrite: uploadRequest.overwrite,
			autoIncrement: uploadRequest.autoIncrement,
		});

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

		let insertedMedia: Media;
		try {
			insertedMedia = await this.mediaRepository.upsert(newMedia);
		} catch (error) {
			try {
				await this.storageService.deleteFile(basePath, fileInfo.filePath);
			} catch (_deleteError) {
				// Ignore rollback error
			}
			throw error;
		}

		if (uploadRequest.sourceUrl) {
			await this.mediaRepository.addUrls(insertedMedia.id, [
				uploadRequest.sourceUrl,
			]);
		}

		await this.jobRepo.create({
			type: "processMedia",
			mediaSourceId: validatedSourceId,
			payload: {
				mediaId: insertedMedia.id,
				sourcePath: basePath,
				type: "processMedia",
			},
		});

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
		const newMediaItems: { id: string; filePath: string }[] = [];

		for (const file of files) {
			try {
				const relativePath = path.relative(directoryPath, file);
				const existing = await this.mediaRepository.findByPath(
					validatedSourceId,
					relativePath,
				);

				if (!existing) {
					try {
						const metadata = await this.storageService.getFileMetadata(file);
						const mediaType = getMediaTypeFromExtension(file);

						const newMedia: AddMediaRequest = {
							mediaSourceId: validatedSourceId,
							filePath: relativePath,
							fileName: path.basename(file),
							mediaType,
							width: metadata.width,
							height: metadata.height,
							fileSize: metadata.size,
							createdAt: metadata.createdAt,
							modifiedAt: metadata.modifiedAt,
							description: null,
						};

						const created = await this.mediaRepository.upsert(newMedia);
						newMediaItems.push({ id: created.id, filePath: relativePath });
					} catch (_e) {
						// Ignore creation errors
					}
				}
			} catch (_e) {
				// Ignore finding errors
			}
		}

		if (newMediaItems.length > 0) {
			for (const item of newMediaItems) {
				await this.jobRepo.create({
					type: "processMedia",
					mediaSourceId: validatedSourceId,
					payload: {
						mediaId: item.id,
						sourcePath: directoryPath,
						type: "processMedia",
					},
				});
			}
		}
	}
}

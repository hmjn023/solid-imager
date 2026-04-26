import {
	createMediaService,
	type MediaPathAdapter,
} from "@solid-imager/application/services/media-service";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	type MediaDetails,
	type MediaSearchRequest,
	type MediaSearchResponse,
	type UpdateMediaRequest,
	updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import type {
	UploadMediaRequest,
	UploadResponse,
} from "@solid-imager/core/domain/media/upload-schemas";
import { uploadMediaRequestSchema } from "@solid-imager/core/domain/media/upload-schemas";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type {
	IMediaStorage,
	MediaMetadata,
	MediaSourceFile,
	MediaStorageResult,
} from "@solid-imager/core/interfaces/media-storage";
import {
	authors,
	characters,
	ips,
	mediaAuthors,
	mediaCharacters,
	mediaGenerationInfo,
	mediaIps,
	mediaTags,
	mediaUrls,
	tags,
} from "@solid-imager/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";
import { basename, dirname, extname, joinLocalPath } from "../../path-utils";
import { TauriAuthorRepository } from "../repositories/author-repository";
import { TauriCharacterRepository } from "../repositories/character-repository";
import { TauriIpRepository } from "../repositories/ip-repository";
import { TauriMediaRepository } from "../repositories/media-repository";
import { TauriProjectRepository } from "../repositories/project-repository";
import { TauriSourceRepository } from "../repositories/source-repository";
import { TauriTagRepository } from "../repositories/tag-repository";

const EXTRACTED_TAG_SOURCE = "comfyui_workflow";
const LOCAL_TAG_SOURCE = "local";
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

type ResolvedUploadTarget = {
	relativePath: string;
	fullPath: string;
	conflict?: UploadResponse["conflict"];
};

function normalizeRelativePath(path: string) {
	return path
		.split(/[\\/]+/)
		.filter((segment) => segment.length > 0 && segment !== ".")
		.join("/");
}

function isSafeRelativeUploadPath(path: string) {
	if (/^(?:[A-Za-z]:[\\/]|\/)/.test(path)) {
		return false;
	}
	return path
		.split(/[\\/]+/)
		.every((segment) => segment.length === 0 || segment === "." || segment !== "..");
}

async function resolveUploadTargetPath(
	rootPath: string,
	requestedPath: string,
	overwrite: boolean,
	autoIncrement: boolean,
): Promise<ResolvedUploadTarget> {
	if (!isSafeRelativeUploadPath(requestedPath)) {
		throw new Error(`Invalid upload path: ${requestedPath}`);
	}

	const normalizedRequested = normalizeRelativePath(requestedPath);
	const requestedFullPath = joinLocalPath(rootPath, normalizedRequested);
	if (overwrite || !(await getTauriAppServices().fileSystem.exists(requestedFullPath))) {
		return {
			relativePath: normalizedRequested,
			fullPath: requestedFullPath,
		};
	}

	if (!autoIncrement) {
		throw new Error(`File already exists: ${normalizedRequested}`);
	}

	const parentDir = dirname(normalizedRequested);
	const extension = extname(normalizedRequested);
	const stem = basename(normalizedRequested).slice(
		0,
		Math.max(0, basename(normalizedRequested).length - extension.length),
	);

	let index = 1;
	while (index <= MAX_FILENAME_COLLISION_ATTEMPTS) {
		const candidateName = `${stem}-${index}${extension}`;
		const candidateRelative =
			parentDir === "/" ? candidateName : normalizeRelativePath(`${parentDir}/${candidateName}`);
		const candidateFullPath = joinLocalPath(rootPath, candidateRelative);
		if (!(await getTauriAppServices().fileSystem.exists(candidateFullPath))) {
			return {
				relativePath: candidateRelative,
				fullPath: candidateFullPath,
				conflict: {
					existingFile: normalizedRequested,
					suggestedName: candidateRelative,
				},
			};
		}
		index += 1;
	}

	throw new Error(
		`Could not resolve a non-conflicting filename after ${MAX_FILENAME_COLLISION_ATTEMPTS} attempts`,
	);
}

async function probeMedia(fullPath: string): Promise<ProbeMediaResult> {
	return await getTauriAppServices().commandClient.invoke<ProbeMediaResult>("probe_media", {
		mediaPath: fullPath,
	});
}

async function ensureParentDirectory(fullPath: string) {
	const parentDir = dirname(fullPath);
	if (parentDir !== "/") {
		await getTauriAppServices().fileSystem.mkdir(parentDir, {
			recursive: true,
		});
	}
}

function mediaCharacterConflictSet(source: string) {
	let sourceUpdateSql = sql`excluded.source`;
	let confidenceUpdateSql = sql`excluded.confidence`;

	if (source === "AI") {
		sourceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.source ELSE media_characters.source END`;
		confidenceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.confidence ELSE media_characters.confidence END`;
	} else if (source === "manual") {
		sourceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.source ELSE media_characters.source END`;
		confidenceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_characters.confidence END`;
	}

	return {
		source: sourceUpdateSql,
		confidence: confidenceUpdateSql,
	};
}

async function persistExtractedMetadata(mediaId: string, fullPath: string, tx: TauriDbExecutor) {
	const extracted = await getTauriAppServices().imageProcessor.extractMetadata(fullPath);

	await tx
		.delete(mediaTags)
		.where(and(eq(mediaTags.mediaId, mediaId), eq(mediaTags.source, EXTRACTED_TAG_SOURCE)));
	await tx.delete(mediaGenerationInfo).where(eq(mediaGenerationInfo.mediaId, mediaId));

	const hasMetadata =
		extracted.tags.length > 0 || extracted.prompt !== null || extracted.workflow !== null;
	if (!hasMetadata) {
		return;
	}

	const uniqueTagNames = Array.from(new Set(extracted.tags.map((tag) => tag.name)));
	if (uniqueTagNames.length > 0) {
		await tx
			.insert(tags)
			.values(
				uniqueTagNames.map((name) => ({
					name,
					source: LOCAL_TAG_SOURCE,
				})),
			)
			.onConflictDoNothing();

		const persistedTags = await tx
			.select({
				id: tags.id,
				name: tags.name,
			})
			.from(tags)
			.where(inArray(tags.name, uniqueTagNames));
		const tagIdByName = new Map(persistedTags.map((tag) => [tag.name, tag.id]));

		await tx
			.insert(mediaTags)
			.values(
				extracted.tags.flatMap((tag) => {
					const tagId = tagIdByName.get(tag.name);
					return tagId
						? [
								{
									mediaId,
									tagId,
									tagType: tag.type,
									confidence: null,
									source: EXTRACTED_TAG_SOURCE,
								},
							]
						: [];
				}),
			)
			.onConflictDoNothing();
	}

	await TauriMediaRepository.upsertGenerationInfo(
		mediaId,
		typeof extracted.prompt === "string"
			? extracted.prompt
			: extracted.prompt
				? JSON.stringify(extracted.prompt)
				: null,
		extracted.workflow && typeof extracted.workflow === "object" ? extracted.workflow : null,
		tx,
	);
}

async function syncContextMetadata(
	mediaId: string,
	updates: UpdateMediaRequest,
	tx: TauriDbExecutor,
) {
	if (updates.sourceUrls !== undefined) {
		await tx.delete(mediaUrls).where(eq(mediaUrls.mediaId, mediaId));
		await TauriMediaRepository.addUrls(mediaId, updates.sourceUrls, tx);
	}

	if (updates.authors !== undefined) {
		await tx.delete(mediaAuthors).where(eq(mediaAuthors.mediaId, mediaId));
		for (const author of updates.authors) {
			const existingAuthor = (
				author.accountId
					? await tx.select().from(authors).where(eq(authors.accountId, author.accountId)).limit(1)
					: await tx.select().from(authors).where(eq(authors.name, author.name)).limit(1)
			)[0];
			const authorId =
				existingAuthor?.id ??
				(
					await tx
						.insert(authors)
						.values({
							name: author.name,
							accountId: author.accountId ?? null,
						})
						.returning({ id: authors.id })
				)[0]?.id;
			if (authorId) {
				await TauriAuthorRepository.addMedia(mediaId, authorId, tx);
			}
		}
	}

	if (updates.characters !== undefined) {
		await tx.delete(mediaCharacters).where(eq(mediaCharacters.mediaId, mediaId));
		for (const character of updates.characters) {
			const existingCharacter = (
				await tx.select().from(characters).where(eq(characters.name, character.name)).limit(1)
			)[0];
			const characterId =
				existingCharacter?.id ??
				(
					await tx
						.insert(characters)
						.values({
							name: character.name,
							description: "",
							source: "manual",
						})
						.returning({ id: characters.id })
				)[0]?.id;
			if (characterId) {
				await TauriCharacterRepository.addMedia(
					mediaId,
					characterId,
					character.confidence ?? undefined,
					"manual",
					tx,
				);
			}
		}
	}

	if (updates.ips !== undefined) {
		await tx.delete(mediaIps).where(eq(mediaIps.mediaId, mediaId));
		for (const ip of updates.ips) {
			const existingIp = (await tx.select().from(ips).where(eq(ips.name, ip.name)).limit(1))[0];
			const ipId =
				existingIp?.id ??
				(
					await tx
						.insert(ips)
						.values({
							name: ip.name,
							description: "",
							source: "manual",
						})
						.returning({ id: ips.id })
				)[0]?.id;
			if (ipId) {
				await TauriIpRepository.addMedia(mediaId, ipId, ip.confidence ?? undefined, "manual", tx);
			}
		}
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
		);
		await ensureParentDirectory(target.fullPath);
		const buffer = await file.arrayBuffer();
		await getTauriAppServices().fileSystem.writeFile(target.fullPath, new Uint8Array(buffer));

		try {
			const metadata = await this.getFileMetadata(target.fullPath);
			return {
				filePath: target.relativePath,
				fileName: basename(target.relativePath),
				width: metadata.width,
				height: metadata.height,
				size: metadata.size,
				createdAt: metadata.createdAt,
				modifiedAt: metadata.modifiedAt,
				conflict: target.conflict,
			};
		} catch (error) {
			await getTauriAppServices().fileSystem.rm(target.fullPath, {
				force: true,
			});
			throw error;
		}
	},

	async deleteFile(basePath: string, filePath: string): Promise<void> {
		await getTauriAppServices().fileSystem.rm(joinLocalPath(basePath, filePath), {
			force: true,
		});
	},

	async getFile(basePath: string, filePath: string): Promise<Uint8Array> {
		return await getTauriAppServices().fileSystem.readFile(joinLocalPath(basePath, filePath));
	},

	async scanDirectory(basePath: string): Promise<string[]> {
		const files: string[] = [];
		const queue = [basePath];
		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) {
				continue;
			}
			for (const entry of await getTauriAppServices().fileSystem.readdir(current)) {
				const fullPath = joinLocalPath(current, entry);
				const stat = await getTauriAppServices().fileSystem.stat(fullPath);
				if (stat.isDirectory) {
					queue.push(fullPath);
				} else {
					files.push(fullPath);
				}
			}
		}
		return files;
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
		);
		await ensureParentDirectory(target.fullPath);
		await getTauriAppServices().fileSystem.copyFile(sourcePath, target.fullPath);

		try {
			const metadata = await this.getFileMetadata(target.fullPath);
			return {
				filePath: target.relativePath,
				fileName: basename(target.relativePath),
				width: metadata.width,
				height: metadata.height,
				size: metadata.size,
				createdAt: metadata.createdAt,
				modifiedAt: metadata.modifiedAt,
				conflict: target.conflict,
			};
		} catch (error) {
			await getTauriAppServices().fileSystem.rm(target.fullPath, {
				force: true,
			});
			throw error;
		}
	},
};

const characterRepository: CharacterRepository = {
	...TauriCharacterRepository,
	addToMedia: TauriCharacterRepository.addMedia,
	removeFromMedia: TauriCharacterRepository.removeMedia,
	async addToMediaBulk(
		mediaId: string,
		charactersToAdd: { id: string; confidence?: number }[],
		source = "manual",
		tx?: Transaction,
	) {
		const rows = charactersToAdd.flatMap((character) => {
			if (!character.id) {
				console.error("Invalid character record: missing id", character);
				return [];
			}

			return [
				{
					mediaId,
					characterId: character.id,
					confidence: character.confidence ?? null,
					source,
				},
			];
		});
		if (rows.length === 0) {
			return;
		}

		const executor = (tx as TauriDbExecutor | undefined) ?? getTauriAppServices().db;
		await executor
			.insert(mediaCharacters)
			.values(rows)
			.onConflictDoUpdate({
				target: [mediaCharacters.mediaId, mediaCharacters.characterId],
				set: mediaCharacterConflictSet(source),
			});
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
			return await getTauriAppServices().imageProcessor.extractMetadata(mediaPath);
		},
		async getDimensions(mediaPath) {
			return await getTauriAppServices().imageProcessor.getDimensions(mediaPath);
		},
	},
	authorRepository: TauriAuthorRepository,
	projectRepository: TauriProjectRepository,
	characterRepository,
	ipRepository: TauriIpRepository,
	transactionManager: {
		async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
			return await getTauriAppServices().db.transaction(callback);
		},
	},
	contextMetadataUpdater: async (mediaId, context, tx) => {
		await syncContextMetadata(
			mediaId,
			updateMediaRequestSchema.parse(context),
			tx as TauriDbExecutor,
		);
	},
	pathAdapter: tauriPathAdapter,
	afterMediaRegistered: async ({ media, sourcePath, filePath }) => {
		await getTauriAppServices().db.transaction(async (tx) => {
			await persistExtractedMetadata(media.id, joinLocalPath(sourcePath, filePath), tx);
		});
	},
});

function bytesToMediaSourceFile(bytes: number[], filename: string): MediaSourceFile {
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

	async getMediaDetails(sourceId: string, mediaId: string): Promise<MediaDetails> {
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
	): Promise<MediaDetails> {
		await mediaService.updateMedia(sourceId, mediaId, updates);
		return await mediaService.getMediaDetails(sourceId, mediaId);
	},

	async deleteMedia(sourceId: string, mediaId: string): Promise<{ success: true }> {
		await mediaService.deleteMedia(sourceId, mediaId);
		return { success: true };
	},

	async copyMedia(
		_mediaSourceId: string,
		mediaId: string,
		targetSourceId: string,
	): Promise<{ success: true }> {
		await getTauriAppServices().db.transaction(async (tx) => {
			await mediaService.copyMedia(mediaId, targetSourceId, tx);
		});
		return { success: true };
	},

	async moveMedia(
		_mediaSourceId: string,
		mediaId: string,
		targetSourceId: string,
	): Promise<{ success: true }> {
		await mediaService.moveMedia(mediaId, targetSourceId);
		return { success: true };
	},
};

import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import {
	type MediaDetails,
	type MediaSearchRequest,
	type MediaSearchResponse,
	type UpdateMediaRequest,
	updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import type { UploadResponse } from "@solid-imager/core/domain/media/upload-schemas";
import { uploadMediaRequestSchema } from "@solid-imager/core/domain/media/upload-schemas";
import { and, eq, inArray } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";
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
import { basename, dirname, extname, joinLocalPath } from "../../path-utils";
import { TauriAuthorRepository } from "../repositories/author-repository";
import { TauriCharacterRepository } from "../repositories/character-repository";
import { TauriIpRepository } from "../repositories/ip-repository";
import { TauriMediaRepository } from "../repositories/media-repository";
import { TauriProjectRepository } from "../repositories/project-repository";
import { TauriSourceRepository } from "../repositories/source-repository";
import { TauriConfigService } from "./config-service";

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

type LocalSource = {
	id: string;
	rootPath: string;
};

type ResolvedUploadTarget = {
	relativePath: string;
	fullPath: string;
	conflict?: UploadResponse["conflict"];
};

type SupportedExtensions = {
	image: string[];
	video: string[];
	audio: string[];
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
		.every(
			(segment) => segment.length === 0 || segment === "." || segment !== "..",
		);
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
	if (
		overwrite ||
		!(await getTauriAppServices().fileSystem.exists(requestedFullPath))
	) {
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
			parentDir === "/"
				? candidateName
				: normalizeRelativePath(`${parentDir}/${candidateName}`);
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

function inferMediaType(
	fileName: string,
	supportedExtensions: SupportedExtensions,
): "image" | "video" | "audio" {
	const extension = extname(fileName).toLowerCase();
	if (supportedExtensions.video.includes(extension)) {
		return "video";
	}
	if (supportedExtensions.audio.includes(extension)) {
		return "audio";
	}
	return "image";
}

async function getLocalSource(
	sourceId: string,
	tx?: TauriDbExecutor,
): Promise<LocalSource> {
	const source = await TauriSourceRepository.findById(sourceId, tx);
	if (!source) {
		throw new ResourceNotFoundError("Media Source", sourceId);
	}
	if (source.type !== "local" || !("path" in source.connectionInfo)) {
		throw new Error("Tauri currently supports only local sources.");
	}

	return {
		id: source.id,
		rootPath: source.connectionInfo.path,
	};
}

async function probeMedia(fullPath: string): Promise<ProbeMediaResult> {
	return await getTauriAppServices().commandClient.invoke<ProbeMediaResult>(
		"probe_media",
		{ mediaPath: fullPath },
	);
}

async function persistExtractedMetadata(
	mediaId: string,
	fullPath: string,
	tx: TauriDbExecutor,
) {
	const extracted =
		await getTauriAppServices().imageProcessor.extractMetadata(fullPath);

	await tx
		.delete(mediaTags)
		.where(
			and(
				eq(mediaTags.mediaId, mediaId),
				eq(mediaTags.source, EXTRACTED_TAG_SOURCE),
			),
		);
	await tx
		.delete(mediaGenerationInfo)
		.where(eq(mediaGenerationInfo.mediaId, mediaId));

	const hasMetadata =
		extracted.tags.length > 0 ||
		extracted.prompt !== null ||
		extracted.workflow !== null;
	if (!hasMetadata) {
		return;
	}

	const uniqueTagNames = Array.from(
		new Set(extracted.tags.map((tag) => tag.name)),
	);
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
		extracted.workflow && typeof extracted.workflow === "object"
			? extracted.workflow
			: null,
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
					? await tx
							.select()
							.from(authors)
							.where(eq(authors.accountId, author.accountId))
							.limit(1)
					: await tx
							.select()
							.from(authors)
							.where(eq(authors.name, author.name))
							.limit(1)
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
		await tx
			.delete(mediaCharacters)
			.where(eq(mediaCharacters.mediaId, mediaId));
		for (const character of updates.characters) {
			const existingCharacter = (
				await tx
					.select()
					.from(characters)
					.where(eq(characters.name, character.name))
					.limit(1)
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
			const existingIp = (
				await tx.select().from(ips).where(eq(ips.name, ip.name)).limit(1)
			)[0];
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
				await TauriIpRepository.addMedia(
					mediaId,
					ipId,
					ip.confidence ?? undefined,
					"manual",
					tx,
				);
			}
		}
	}
}

async function copyMediaRelations(
	sourceMediaId: string,
	targetMediaId: string,
	tx: TauriDbExecutor,
) {
	const [
		sourceAuthors,
		sourceProjects,
		sourceCharacters,
		sourceIps,
		sourceUrls,
	] = await Promise.all([
		TauriAuthorRepository.findByMediaId(sourceMediaId, tx),
		TauriProjectRepository.findByMediaId(sourceMediaId),
		TauriCharacterRepository.findByMediaId(sourceMediaId),
		TauriIpRepository.findByMediaId(sourceMediaId),
		TauriMediaRepository.getUrls(sourceMediaId, tx),
	]);

	await TauriAuthorRepository.addMediaBulk(
		targetMediaId,
		sourceAuthors.map((author) => author.id),
		tx,
	);

	for (const project of sourceProjects) {
		await TauriProjectRepository.addMedia(targetMediaId, project.id);
	}

	for (const character of sourceCharacters) {
		await TauriCharacterRepository.addMedia(
			targetMediaId,
			character.id,
			undefined,
			"manual",
			tx,
		);
	}

	for (const ip of sourceIps) {
		await TauriIpRepository.addMedia(
			targetMediaId,
			ip.id,
			undefined,
			"manual",
			tx,
		);
	}

	if (sourceUrls.length > 0) {
		await TauriMediaRepository.addUrls(
			targetMediaId,
			sourceUrls.map((item) => item.url),
			tx,
		);
	}

	const sourceTags = await TauriMediaRepository.getTags(sourceMediaId, tx);
	if (sourceTags.length > 0) {
		await tx
			.insert(mediaTags)
			.values(
				sourceTags.map((tag) => ({
					mediaId: targetMediaId,
					tagId: tag.id,
					tagType: tag.type,
					confidence: tag.confidence ?? null,
					source: tag.source,
				})),
			)
			.onConflictDoNothing();
	}

	const sourceGenerationInfo = await TauriMediaRepository.getGenerationInfo(
		sourceMediaId,
		tx,
	);
	if (sourceGenerationInfo) {
		await tx.insert(mediaGenerationInfo).values({
			mediaId: targetMediaId,
			metadata: sourceGenerationInfo.metadata,
			prompt: sourceGenerationInfo.prompt,
			negativePrompt: sourceGenerationInfo.negativePrompt,
			workflow: sourceGenerationInfo.workflow,
			loras: sourceGenerationInfo.loras,
			vae: sourceGenerationInfo.vae,
			hypernetworks: sourceGenerationInfo.hypernetworks,
			embeddings: sourceGenerationInfo.embeddings,
			aiGenerated: sourceGenerationInfo.aiGenerated,
			modelName: sourceGenerationInfo.modelName,
			seed: sourceGenerationInfo.seed,
			cfgScale: sourceGenerationInfo.cfgScale,
			steps: sourceGenerationInfo.steps,
		});
	}
}

async function getVerifiedDetails(
	sourceId: string,
	mediaId: string,
	tx?: TauriDbExecutor,
): Promise<MediaDetails> {
	const details = await TauriMediaRepository.getDetails(mediaId, tx);
	if (!details || details.mediaSourceId !== sourceId) {
		throw new ResourceNotFoundError("Media", mediaId);
	}
	return details;
}

export const TauriMediaService = {
	async search(
		sourceId: string | undefined | null,
		params: MediaSearchRequest,
	): Promise<MediaSearchResponse> {
		return sourceId
			? await TauriMediaRepository.search(sourceId, params)
			: await TauriMediaRepository.globalSearch(params);
	},

	async getDetails(sourceId: string, mediaId: string): Promise<MediaDetails> {
		const details = await getVerifiedDetails(sourceId, mediaId);
		if (details.generationInfo) {
			return details;
		}

		const source = await getLocalSource(sourceId);
		const fullPath = joinLocalPath(source.rootPath, details.filePath);

		await getTauriAppServices().db.transaction(async (tx) => {
			await persistExtractedMetadata(mediaId, fullPath, tx);
		});

		return await getVerifiedDetails(sourceId, mediaId);
	},

	async upload(
		sourceId: string,
		bytes: number[],
		options: {
			filename?: string;
			description?: string;
			sourceUrl?: string;
			overwrite?: string;
			autoIncrement?: string;
		},
	): Promise<UploadResponse> {
		const uploadRequest = uploadMediaRequestSchema.parse(options);
		const source = await getLocalSource(sourceId);
		const config = await TauriConfigService.getConfig();
		const requestedPath = uploadRequest.filename?.trim();
		if (!requestedPath) {
			throw new Error("Filename is required");
		}

		const target = await resolveUploadTargetPath(
			source.rootPath,
			requestedPath,
			uploadRequest.overwrite ?? false,
			uploadRequest.autoIncrement ?? false,
		);

		const parentDir = dirname(target.fullPath);
		if (parentDir !== "/") {
			await getTauriAppServices().fileSystem.mkdir(parentDir, {
				recursive: true,
			});
		}

		await getTauriAppServices().fileSystem.writeFile(
			target.fullPath,
			new Uint8Array(bytes),
		);

		try {
			const probe = await probeMedia(target.fullPath);
			const media = await getTauriAppServices().db.transaction(async (tx) => {
				const created = await TauriMediaRepository.upsert(
					{
						mediaSourceId: source.id,
						filePath: target.relativePath,
						fileName: basename(target.relativePath),
						mediaType: inferMediaType(
							target.relativePath,
							config.media.supportedExtensions,
						),
						width: probe.width,
						height: probe.height,
						fileSize: probe.size,
						description: uploadRequest.description ?? null,
						createdAt: new Date(probe.createdAt),
						modifiedAt: new Date(probe.modifiedAt),
					},
					tx,
				);

				if (uploadRequest.sourceUrl) {
					await TauriMediaRepository.addUrls(
						created.id,
						[uploadRequest.sourceUrl],
						tx,
					);
				}

				await persistExtractedMetadata(created.id, target.fullPath, tx);
				return created;
			});

			return {
				success: Boolean(media),
				filePath: target.relativePath,
				conflict: target.conflict,
			};
		} catch (error) {
			await getTauriAppServices().fileSystem.rm(target.fullPath, {
				force: true,
			});
			throw error;
		}
	},

	async update(
		sourceId: string,
		mediaId: string,
		updates: UpdateMediaRequest,
	): Promise<MediaDetails> {
		const parsedUpdates = updateMediaRequestSchema.parse(updates);

		return await getTauriAppServices().db.transaction(async (tx) => {
			const existing = await TauriMediaRepository.findById(mediaId, tx);
			if (!existing || existing.mediaSourceId !== sourceId) {
				throw new ResourceNotFoundError("Media", mediaId);
			}

			await TauriMediaRepository.update(mediaId, parsedUpdates, tx);
			await syncContextMetadata(mediaId, parsedUpdates, tx);

			return await getVerifiedDetails(sourceId, mediaId, tx);
		});
	},

	async delete(sourceId: string, mediaId: string): Promise<{ success: true }> {
		const source = await getLocalSource(sourceId);
		const media = await getVerifiedDetails(sourceId, mediaId);
		const fullPath = joinLocalPath(source.rootPath, media.filePath);

		await getTauriAppServices().db.transaction(async (tx) => {
			await TauriMediaRepository.delete(mediaId, tx);
		});

		await getTauriAppServices().fileSystem.rm(fullPath, { force: true });
		return { success: true };
	},

	async copy(
		mediaId: string,
		targetSourceId: string,
	): Promise<{ success: true }> {
		return await getTauriAppServices().db.transaction(async (tx) => {
			const sourceMedia = await TauriMediaRepository.findById(mediaId, tx);
			if (!sourceMedia) {
				throw new ResourceNotFoundError("Media", mediaId);
			}

			const source = await getLocalSource(sourceMedia.mediaSourceId, tx);
			const targetSource = await getLocalSource(targetSourceId, tx);
			const config = await TauriConfigService.getConfig();
			const sourcePath = joinLocalPath(source.rootPath, sourceMedia.filePath);
			const target = await resolveUploadTargetPath(
				targetSource.rootPath,
				sourceMedia.fileName,
				false,
				true,
			);

			const parentDir = dirname(target.fullPath);
			if (parentDir !== "/") {
				await getTauriAppServices().fileSystem.mkdir(parentDir, {
					recursive: true,
				});
			}

			await getTauriAppServices().fileSystem.copyFile(
				sourcePath,
				target.fullPath,
			);
			const probe = await probeMedia(target.fullPath);
			const copied = await TauriMediaRepository.create(
				{
					mediaSourceId: targetSource.id,
					filePath: target.relativePath,
					fileName: basename(target.relativePath),
					mediaType: inferMediaType(
						target.relativePath,
						config.media.supportedExtensions,
					),
					width: probe.width,
					height: probe.height,
					fileSize: probe.size,
					description: sourceMedia.description,
					createdAt: sourceMedia.createdAt,
					modifiedAt: sourceMedia.modifiedAt,
				},
				tx,
			);

			await copyMediaRelations(sourceMedia.id, copied.id, tx);
			return { success: true };
		});
	},

	async move(
		mediaId: string,
		targetSourceId: string,
	): Promise<{ success: true }> {
		return await getTauriAppServices().db.transaction(async (tx) => {
			const sourceMedia = await TauriMediaRepository.findById(mediaId, tx);
			if (!sourceMedia) {
				throw new ResourceNotFoundError("Media", mediaId);
			}

			const source = await getLocalSource(sourceMedia.mediaSourceId, tx);
			const targetSource = await getLocalSource(targetSourceId, tx);
			const config = await TauriConfigService.getConfig();
			const sourcePath = joinLocalPath(source.rootPath, sourceMedia.filePath);
			const target = await resolveUploadTargetPath(
				targetSource.rootPath,
				sourceMedia.fileName,
				false,
				true,
			);

			const parentDir = dirname(target.fullPath);
			if (parentDir !== "/") {
				await getTauriAppServices().fileSystem.mkdir(parentDir, {
					recursive: true,
				});
			}

			await getTauriAppServices().fileSystem.rename(
				sourcePath,
				target.fullPath,
			);
			const probe = await probeMedia(target.fullPath);
			const moved = await TauriMediaRepository.create(
				{
					mediaSourceId: targetSource.id,
					filePath: target.relativePath,
					fileName: basename(target.relativePath),
					mediaType: inferMediaType(
						target.relativePath,
						config.media.supportedExtensions,
					),
					width: probe.width,
					height: probe.height,
					fileSize: probe.size,
					description: sourceMedia.description,
					createdAt: sourceMedia.createdAt,
					modifiedAt: sourceMedia.modifiedAt,
				},
				tx,
			);

			await copyMediaRelations(sourceMedia.id, moved.id, tx);
			await TauriMediaRepository.delete(sourceMedia.id, tx);
			return { success: true };
		});
	},
};

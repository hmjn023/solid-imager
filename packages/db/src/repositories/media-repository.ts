import { ResourceNotFoundError, UnexpectedError } from "@solid-imager/core/domain/errors";
import type {
	AddMediaRequest,
	Author,
	Media,
	MediaDetails,
	MediaGenerationInfo,
	MediaSearchRequest,
	MediaSearchResponse,
	MediaTag,
	MediaUrl,
	UpdateMediaRequest,
} from "@solid-imager/core/domain/media/schemas";
import {
	authorSchema,
	mediaDetailsSchema,
	mediaGenerationInfoSchema,
	mediaSchema,
	mediaUrlSchema,
	tagSchema,
} from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import { and, asc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import {
	authors,
	type characters,
	type ips,
	mediaAuthors,
	type mediaCharacters,
	mediaGenerationInfo,
	type mediaIps,
	medias,
	mediaTags,
	mediaUrls,
	type NewMedia,
	tags,
} from "../schema";
import type { DrizzleExecutor } from "../types";
import { executeMediaSearch, executeMediaSearchInDirectory } from "./media-search";

export type MediaRepositoryExecutorProvider = (tx?: unknown) => DrizzleExecutor;

export type UpsertMediaInput = {
	mediaSourceId: string;
	filePath: string;
	fileName: string;
	mediaType: "image" | "video" | "audio";
	width: number;
	height: number;
	fileSize: number | null;
	description: string | null;
	createdAt: Date;
	modifiedAt: Date;
};

export type MediaRepository = IMediaRepository & {
	batchUpsert(
		inputs: UpsertMediaInput[],
		tx?: unknown,
	): Promise<Array<{ id: string; filePath: string }>>;
	deleteBySourceIdAndPathPrefix(
		sourceId: string,
		folderPath: string,
		tx?: unknown,
	): Promise<Array<{ id: string; filePath: string }>>;
};

function mapToMedia(row: typeof medias.$inferSelect): Media {
	return mediaSchema.parse(row);
}

function mapToMediaUrl(row: typeof mediaUrls.$inferSelect): MediaUrl {
	return mediaUrlSchema.parse(row);
}

function mapToMediaGenerationInfo(
	row: typeof mediaGenerationInfo.$inferSelect,
): MediaGenerationInfo {
	return mediaGenerationInfoSchema.parse({
		...row,
		aiGenerated: row.aiGenerated ?? false,
		modelName: row.modelName ?? "",
		seed: row.seed ?? -1,
		cfgScale: row.cfgScale ?? 0,
		steps: row.steps ?? 0,
	});
}

type MediaWithRelations = typeof medias.$inferSelect & {
	tags: Array<
		typeof mediaTags.$inferSelect & {
			tag: typeof tags.$inferSelect;
		}
	>;
	generationInfo: typeof mediaGenerationInfo.$inferSelect | null;
	authors: Array<
		typeof mediaAuthors.$inferSelect & {
			author: typeof authors.$inferSelect;
		}
	>;
	urls: Array<typeof mediaUrls.$inferSelect>;
	characters: Array<
		typeof mediaCharacters.$inferSelect & {
			character: typeof characters.$inferSelect;
		}
	>;
	ips: Array<
		typeof mediaIps.$inferSelect & {
			ip: typeof ips.$inferSelect;
		}
	>;
};

function mapToMediaDetails(row: MediaWithRelations): MediaDetails {
	return mediaDetailsSchema.parse({
		...mapToMedia(row),
		tags: row.tags.map((item) => ({
			...item.tag,
			type: item.tagType,
			source: item.source,
			confidence: item.confidence,
		})),
		generationInfo: row.generationInfo ? mapToMediaGenerationInfo(row.generationInfo) : null,
		authors: row.authors.map((item) => item.author),
		urls: row.urls.map(mapToMediaUrl),
		characters: row.characters.map((item) => ({
			...item.character,
			confidence: item.confidence,
			linkSource: item.source,
		})),
		ips: row.ips.map((item) => ({
			...item.ip,
			confidence: item.confidence,
			linkSource: item.source,
		})),
	});
}

function escapeLikePattern(value: string): string {
	return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function getExecutor(getExecutorFn: MediaRepositoryExecutorProvider, tx?: unknown) {
	return getExecutorFn(tx);
}

async function selectMediaDetails(
	client: DrizzleExecutor,
	mediaId: string,
): Promise<MediaDetails | null> {
	const row = await client.query.medias.findFirst({
		where: eq(medias.id, mediaId),
		with: {
			tags: {
				with: {
					tag: true,
				},
			},
			generationInfo: true,
			authors: {
				with: {
					author: true,
				},
			},
			urls: true,
			characters: {
				with: {
					character: true,
				},
			},
			ips: {
				with: {
					ip: true,
				},
			},
		},
	});

	return row ? mapToMediaDetails(row as MediaWithRelations) : null;
}

export function createMediaRepository(
	getExecutorFn: MediaRepositoryExecutorProvider,
): MediaRepository {
	return {
		async findById(mediaId: string, tx?: unknown): Promise<Media | null> {
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.select()
					.from(medias)
					.where(eq(medias.id, mediaId))
					.limit(1);
				return rows[0] ? mapToMedia(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError(`Failed to select media by ID: ${mediaId}`, error);
			}
		},

		async findByPath(sourceId: string, filePath: string, tx?: unknown): Promise<Media | null> {
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.select()
					.from(medias)
					.where(and(eq(medias.mediaSourceId, sourceId), eq(medias.filePath, filePath)))
					.limit(1);
				return rows[0] ? mapToMedia(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError("Failed to select media by source ID and file path", error);
			}
		},

		async create(media: AddMediaRequest, tx?: unknown): Promise<Media> {
			try {
				const newMedia: NewMedia = {
					...media,
					status: "active",
					indexedAt: new Date(),
				};
				const rows = await getExecutor(getExecutorFn, tx)
					.insert(medias)
					.values(newMedia)
					.returning();
				return mapToMedia(rows[0]);
			} catch (error) {
				throw new UnexpectedError("Failed to insert media", error);
			}
		},

		async upsert(media: AddMediaRequest, tx?: unknown): Promise<Media> {
			try {
				const newMedia: NewMedia = {
					...media,
					status: "active",
					indexedAt: new Date(),
				};
				const rows = await getExecutor(getExecutorFn, tx)
					.insert(medias)
					.values(newMedia)
					.onConflictDoUpdate({
						target: [medias.mediaSourceId, medias.filePath],
						set: {
							fileName: newMedia.fileName,
							mediaType: newMedia.mediaType,
							width: newMedia.width,
							height: newMedia.height,
							fileSize: newMedia.fileSize,
							description: newMedia.description,
							createdAt: newMedia.createdAt,
							modifiedAt: newMedia.modifiedAt,
							indexedAt: newMedia.indexedAt,
							status: newMedia.status,
						},
					})
					.returning();
				return mapToMedia(rows[0]);
			} catch (error) {
				throw new UnexpectedError("Failed to upsert media", error);
			}
		},

		async update(mediaId: string, updates: UpdateMediaRequest, tx?: unknown): Promise<Media> {
			try {
				const dbUpdates: Partial<NewMedia> = {};
				if (updates.filePath !== undefined) {
					dbUpdates.filePath = updates.filePath;
				}
				if (updates.fileName !== undefined) {
					dbUpdates.fileName = updates.fileName;
				}
				if (updates.fileSize !== undefined) {
					dbUpdates.fileSize = updates.fileSize;
				}
				if (updates.mediaType !== undefined) {
					dbUpdates.mediaType = updates.mediaType;
				}
				if (updates.width !== undefined) {
					dbUpdates.width = updates.width;
				}
				if (updates.height !== undefined) {
					dbUpdates.height = updates.height;
				}
				if (updates.description !== undefined) {
					dbUpdates.description = updates.description;
				}
				if (updates.createdAt !== undefined) {
					dbUpdates.createdAt = updates.createdAt;
				}
				dbUpdates.modifiedAt = updates.modifiedAt ?? new Date();

				const rows = await getExecutor(getExecutorFn, tx)
					.update(medias)
					.set(dbUpdates)
					.where(eq(medias.id, mediaId))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("Media", mediaId);
				}
				return mapToMedia(rows[0]);
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(`Failed to update media with ID: ${mediaId}`, error);
			}
		},

		async delete(mediaId: string, tx?: unknown): Promise<void> {
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.delete(medias)
					.where(eq(medias.id, mediaId))
					.returning();
				if (!rows[0]) {
					throw new ResourceNotFoundError("Media", mediaId);
				}
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(`Failed to delete media with ID: ${mediaId}`, error);
			}
		},

		search(
			mediaSourceId: string,
			params: MediaSearchRequest,
			tx?: unknown,
		): Promise<MediaSearchResponse> {
			return executeMediaSearch({
				client: getExecutor(getExecutorFn, tx),
				params,
				mediaSourceId,
				mapMedia: mapToMedia,
			});
		},

		globalSearch(params: MediaSearchRequest, tx?: unknown): Promise<MediaSearchResponse> {
			return executeMediaSearch({
				client: getExecutor(getExecutorFn, tx),
				params,
				mapMedia: mapToMedia,
			});
		},

		async getDetails(mediaId: string, tx?: unknown): Promise<MediaDetails | null> {
			try {
				return await selectMediaDetails(getExecutor(getExecutorFn, tx), mediaId);
			} catch (error) {
				throw new UnexpectedError(`Failed to get media details for mediaId: ${mediaId}`, error);
			}
		},

		async getTags(mediaId: string, tx?: unknown): Promise<MediaTag[]> {
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.select({
						id: tags.id,
						name: tags.name,
						description: tags.description,
						attribute: tags.attribute,
						color: tags.color,
						source: mediaTags.source,
						authorId: tags.authorId,
						createdAt: tags.createdAt,
						updatedAt: tags.updatedAt,
						type: mediaTags.tagType,
						confidence: mediaTags.confidence,
					})
					.from(mediaTags)
					.innerJoin(tags, eq(mediaTags.tagId, tags.id))
					.where(eq(mediaTags.mediaId, mediaId))
					.orderBy(asc(tags.name));
				return rows.map((row) => tagSchema.parse(row));
			} catch (error) {
				throw new UnexpectedError(`Failed to retrieve tags for media ID: ${mediaId}`, error);
			}
		},

		async getGenerationInfo(mediaId: string, tx?: unknown): Promise<MediaGenerationInfo | null> {
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.select()
					.from(mediaGenerationInfo)
					.where(eq(mediaGenerationInfo.mediaId, mediaId))
					.limit(1);
				return rows[0] ? mapToMediaGenerationInfo(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select media generation info for mediaId: ${mediaId}`,
					error,
				);
			}
		},

		async upsertGenerationInfo(
			mediaId: string,
			prompt: string | null,
			workflow: unknown,
			tx?: unknown,
		): Promise<MediaGenerationInfo> {
			try {
				const values = {
					mediaId,
					prompt,
					workflow,
					metadata: { prompt },
					aiGenerated: Boolean(prompt || workflow),
				};
				const rows = await getExecutor(getExecutorFn, tx)
					.insert(mediaGenerationInfo)
					.values(values)
					.onConflictDoUpdate({
						target: mediaGenerationInfo.mediaId,
						set: values,
					})
					.returning();
				return mapToMediaGenerationInfo(rows[0]);
			} catch (error) {
				throw new UnexpectedError(
					`Failed to upsert media generation info for mediaId: ${mediaId}`,
					error,
				);
			}
		},

		async getAuthors(mediaId: string, tx?: unknown): Promise<Author[]> {
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.select({
						id: authors.id,
						name: authors.name,
						accountId: authors.accountId,
						createdAt: authors.createdAt,
						updatedAt: authors.updatedAt,
					})
					.from(mediaAuthors)
					.innerJoin(authors, eq(mediaAuthors.authorId, authors.id))
					.where(eq(mediaAuthors.mediaId, mediaId))
					.orderBy(asc(authors.name));
				return rows.map((row) => authorSchema.parse(row));
			} catch (error) {
				throw new UnexpectedError(`Failed to retrieve authors for media ID: ${mediaId}`, error);
			}
		},

		async getUrls(mediaId: string, tx?: unknown): Promise<MediaUrl[]> {
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.select()
					.from(mediaUrls)
					.where(eq(mediaUrls.mediaId, mediaId));
				return rows.map(mapToMediaUrl);
			} catch (error) {
				throw new UnexpectedError(`Failed to select media URLs for mediaId: ${mediaId}`, error);
			}
		},

		async addUrls(mediaId: string, urls: string[], tx?: unknown): Promise<MediaUrl[]> {
			if (urls.length === 0) {
				return [];
			}

			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.insert(mediaUrls)
					.values(urls.map((url) => ({ mediaId, url })))
					.onConflictDoNothing({
						target: [mediaUrls.mediaId, mediaUrls.url],
					})
					.returning();
				return rows.map(mapToMediaUrl);
			} catch (error) {
				throw new UnexpectedError("Failed to insert media URLs", error);
			}
		},

		async findExistingUrls(urls: string[], tx?: unknown): Promise<string[]> {
			if (urls.length === 0) {
				return [];
			}

			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.select({ url: mediaUrls.url })
					.from(mediaUrls)
					.where(inArray(mediaUrls.url, urls));
				return rows.map((row) => row.url);
			} catch (error) {
				throw new UnexpectedError("Failed to check existing URLs", error);
			}
		},

		async findAllBySourceId(
			mediaSourceId: string,
			limit = 100,
			offset = 0,
			tx?: unknown,
		): Promise<Media[]> {
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.select()
					.from(medias)
					.where(eq(medias.mediaSourceId, mediaSourceId))
					.limit(limit)
					.offset(offset);
				return rows.map(mapToMedia);
			} catch (error) {
				throw new UnexpectedError(`Failed to select medias by source ID: ${mediaSourceId}`, error);
			}
		},

		async searchInDirectory(
			mediaSourceId: string,
			directoryPath: string,
			params: { query?: string; tags?: string[] },
			tx?: unknown,
		): Promise<Media[]> {
			return await executeMediaSearchInDirectory({
				client: getExecutor(getExecutorFn, tx),
				mediaSourceId,
				directoryPath,
				params,
				mapMedia: mapToMedia,
			});
		},

		async findIdsWithMissingGenerationInfo(
			tx?: unknown,
		): Promise<Array<{ id: string; mediaSourceId: string; filePath: string }>> {
			try {
				return await getExecutor(getExecutorFn, tx)
					.select({
						id: medias.id,
						mediaSourceId: medias.mediaSourceId,
						filePath: medias.filePath,
					})
					.from(medias)
					.leftJoin(mediaGenerationInfo, eq(medias.id, mediaGenerationInfo.mediaId))
					.where(and(eq(medias.status, "active"), isNull(mediaGenerationInfo.mediaId)));
			} catch (error) {
				throw new UnexpectedError("Failed to select media IDs with missing generation info", error);
			}
		},

		async findAllMediaIndices(
			tx?: unknown,
			options?: { limit?: number; offset?: number },
		): Promise<Array<{ id: string; mediaSourceId: string; filePath: string }>> {
			try {
				let query: any = getExecutor(getExecutorFn, tx)
					.select({
						id: medias.id,
						mediaSourceId: medias.mediaSourceId,
						filePath: medias.filePath,
					})
					.from(medias)
					.where(eq(medias.status, "active"))
					.$dynamic();

				if (options?.limit !== undefined) {
					query = query.limit(options.limit);
				}
				if (options?.offset !== undefined) {
					query = query.offset(options.offset);
				}

				return await query;
			} catch (error) {
				throw new UnexpectedError("Failed to select media indices", error);
			}
		},

		async findAllPathsBySourceId(
			mediaSourceId: string,
			tx?: unknown,
		): Promise<Array<{ id: string; filePath: string }>> {
			try {
				return await getExecutor(getExecutorFn, tx)
					.select({
						id: medias.id,
						filePath: medias.filePath,
					})
					.from(medias)
					.where(eq(medias.mediaSourceId, mediaSourceId));
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select media paths by source ID: ${mediaSourceId}`,
					error,
				);
			}
		},

		async batchUpsert(
			inputs: UpsertMediaInput[],
			tx?: unknown,
		): Promise<Array<{ id: string; filePath: string }>> {
			if (inputs.length === 0) {
				return [];
			}

			const now = new Date();
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.insert(medias)
					.values(
						inputs.map((input) => ({
							mediaSourceId: input.mediaSourceId,
							filePath: input.filePath,
							fileName: input.fileName,
							mediaType: input.mediaType,
							width: input.width,
							height: input.height,
							fileSize: input.fileSize,
							description: input.description,
							createdAt: input.createdAt,
							modifiedAt: input.modifiedAt,
							indexedAt: now,
							status: "active" as const,
						})),
					)
					.onConflictDoUpdate({
						target: [medias.mediaSourceId, medias.filePath],
						set: {
							fileName: sql`excluded.file_name`,
							mediaType: sql`excluded.media_type`,
							width: sql`excluded.width`,
							height: sql`excluded.height`,
							fileSize: sql`excluded.file_size`,
							modifiedAt: sql`excluded.modified_at`,
							indexedAt: sql`${now}`,
							status: sql`excluded.status`,
						},
					})
					.returning();
				return rows.map((row) => ({
					id: row.id,
					filePath: row.filePath,
				}));
			} catch (error) {
				throw new UnexpectedError("Failed to batch upsert media", error);
			}
		},

		async deleteBySourceIdAndPathPrefix(
			sourceId: string,
			folderPath: string,
			tx?: unknown,
		): Promise<Array<{ id: string; filePath: string }>> {
			const normalizedFolderPath = folderPath.replace(/[\\/]+$/, "");
			if (!normalizedFolderPath) {
				return [];
			}

			const prefixPattern = `${escapeLikePattern(normalizedFolderPath)}/`;
			try {
				const rows = await getExecutor(getExecutorFn, tx)
					.delete(medias)
					.where(
						and(
							eq(medias.mediaSourceId, sourceId),
							or(
								eq(medias.filePath, normalizedFolderPath),
								like(medias.filePath, `${prefixPattern}%`),
							),
						),
					)
					.returning();
				return rows.map((row) => ({
					id: row.id,
					filePath: row.filePath,
				}));
			} catch (error) {
				throw new UnexpectedError(
					`Failed to delete media by source ID and path prefix: ${sourceId}`,
					error,
				);
			}
		},
	};
}

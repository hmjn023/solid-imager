import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	AddMediaRequest,
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
	mediaDetailsSchema,
	mediaGenerationInfoSchema,
	mediaSchema,
	mediaUrlSchema,
	tagSchema,
} from "@solid-imager/core/domain/media/schemas";
import { executeMediaSearch } from "@solid-imager/db/repositories/media-search";
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
	tags,
} from "@solid-imager/db/schema";
import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";

function getExecutor(tx?: TauriDbExecutor) {
	return tx ?? getTauriAppServices().db;
}

function escapeLikePattern(value: string): string {
	return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function toMedia(row: typeof medias.$inferSelect): Media {
	return mediaSchema.parse(row);
}

function toMediaUrl(row: typeof mediaUrls.$inferSelect): MediaUrl {
	return mediaUrlSchema.parse(row);
}

function toMediaGenerationInfo(
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
		...toMedia(row),
		tags: row.tags.map((item) => ({
			...item.tag,
			type: item.tagType,
			source: item.source,
			confidence: item.confidence,
		})),
		generationInfo: row.generationInfo
			? toMediaGenerationInfo(row.generationInfo)
			: null,
		authors: row.authors.map((item) => item.author),
		urls: row.urls.map(toMediaUrl),
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

async function executeSearch(
	params: MediaSearchRequest,
	mediaSourceId?: string,
	tx?: TauriDbExecutor,
): Promise<MediaSearchResponse> {
	return await executeMediaSearch({
		client: getExecutor(tx),
		params,
		mediaSourceId,
		mapMedia: toMedia,
	});
}

export type UpsertTauriMediaInput = {
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

export const TauriMediaRepository = {
	async create(input: AddMediaRequest, tx?: TauriDbExecutor): Promise<Media> {
		const rows = await getExecutor(tx)
			.insert(medias)
			.values({
				mediaSourceId: input.mediaSourceId,
				filePath: input.filePath,
				fileName: input.fileName,
				mediaType: input.mediaType,
				width: input.width,
				height: input.height,
				fileSize: input.fileSize,
				description: input.description,
				createdAt: input.createdAt ?? new Date(),
				modifiedAt: input.modifiedAt ?? new Date(),
				indexedAt: new Date(),
				status: "active",
			})
			.returning();

		return toMedia(rows[0]);
	},

	async findById(id: string, tx?: TauriDbExecutor): Promise<Media | null> {
		const rows = await getExecutor(tx)
			.select()
			.from(medias)
			.where(eq(medias.id, id))
			.limit(1);
		return rows[0] ? toMedia(rows[0]) : null;
	},

	async findByPath(
		sourceId: string,
		filePath: string,
		tx?: TauriDbExecutor,
	): Promise<Media | null> {
		const rows = await getExecutor(tx)
			.select()
			.from(medias)
			.where(
				and(eq(medias.mediaSourceId, sourceId), eq(medias.filePath, filePath)),
			)
			.limit(1);
		return rows[0] ? toMedia(rows[0]) : null;
	},

	async upsert(
		input: UpsertTauriMediaInput,
		tx?: TauriDbExecutor,
	): Promise<Media> {
		const rows = await getExecutor(tx)
			.insert(medias)
			.values({
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
				indexedAt: new Date(),
				status: "active",
			})
			.onConflictDoUpdate({
				target: [medias.mediaSourceId, medias.filePath],
				set: {
					fileName: input.fileName,
					mediaType: input.mediaType,
					width: input.width,
					height: input.height,
					fileSize: input.fileSize,
					description: input.description,
					createdAt: input.createdAt,
					modifiedAt: input.modifiedAt,
					indexedAt: new Date(),
					status: "active",
				},
			})
			.returning();
		return toMedia(rows[0]);
	},

	async update(
		id: string,
		updates: UpdateMediaRequest,
		tx?: TauriDbExecutor,
	): Promise<Media> {
		const dbUpdates: Record<string, unknown> = {};
		if (updates.filePath !== undefined) dbUpdates.filePath = updates.filePath;
		if (updates.fileName !== undefined) dbUpdates.fileName = updates.fileName;
		if (updates.fileSize !== undefined) dbUpdates.fileSize = updates.fileSize;
		if (updates.mediaType !== undefined)
			dbUpdates.mediaType = updates.mediaType;
		if (updates.width !== undefined) dbUpdates.width = updates.width;
		if (updates.height !== undefined) dbUpdates.height = updates.height;
		if (updates.description !== undefined) {
			dbUpdates.description = updates.description;
		}
		if (updates.createdAt !== undefined)
			dbUpdates.createdAt = updates.createdAt;
		dbUpdates.modifiedAt = updates.modifiedAt ?? new Date();

		const rows = await getExecutor(tx)
			.update(medias)
			.set(dbUpdates)
			.where(eq(medias.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Media", id);
		}

		return toMedia(rows[0]);
	},

	async delete(id: string, tx?: TauriDbExecutor): Promise<void> {
		const rows = await getExecutor(tx)
			.delete(medias)
			.where(eq(medias.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Media", id);
		}
	},

	async search(
		sourceId: string,
		params: MediaSearchRequest,
		tx?: TauriDbExecutor,
	): Promise<MediaSearchResponse> {
		return await executeSearch(params, sourceId, tx);
	},

	async globalSearch(
		params: MediaSearchRequest,
		tx?: TauriDbExecutor,
	): Promise<MediaSearchResponse> {
		return await executeSearch(params, undefined, tx);
	},

	async getDetails(
		mediaId: string,
		tx?: TauriDbExecutor,
	): Promise<MediaDetails | null> {
		const row = await getExecutor(tx).query.medias.findFirst({
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

		return row ? mapToMediaDetails(row as unknown as MediaWithRelations) : null;
	},

	async getUrls(mediaId: string, tx?: TauriDbExecutor): Promise<MediaUrl[]> {
		const rows = await getExecutor(tx)
			.select()
			.from(mediaUrls)
			.where(eq(mediaUrls.mediaId, mediaId));
		return rows.map(toMediaUrl);
	},

	async getAuthors(mediaId: string, tx?: TauriDbExecutor) {
		const rows = await getExecutor(tx)
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
	},

	async getTags(mediaId: string, tx?: TauriDbExecutor): Promise<MediaTag[]> {
		const rows = await getExecutor(tx)
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
	},

	async getGenerationInfo(
		mediaId: string,
		tx?: TauriDbExecutor,
	): Promise<MediaGenerationInfo | null> {
		const rows = await getExecutor(tx)
			.select()
			.from(mediaGenerationInfo)
			.where(eq(mediaGenerationInfo.mediaId, mediaId))
			.limit(1);
		return rows[0] ? toMediaGenerationInfo(rows[0]) : null;
	},

	async upsertGenerationInfo(
		mediaId: string,
		prompt: string | null,
		workflow: object | null,
		tx?: TauriDbExecutor,
	): Promise<void> {
		await getExecutor(tx)
			.insert(mediaGenerationInfo)
			.values({
				mediaId,
				prompt,
				workflow,
				aiGenerated: Boolean(prompt || workflow),
			})
			.onConflictDoUpdate({
				target: mediaGenerationInfo.mediaId,
				set: {
					prompt,
					workflow,
					aiGenerated: Boolean(prompt || workflow),
				},
			});
	},

	async addUrls(
		mediaId: string,
		urls: string[],
		tx?: TauriDbExecutor,
	): Promise<MediaUrl[]> {
		if (urls.length === 0) {
			return [];
		}

		const rows = await getExecutor(tx)
			.insert(mediaUrls)
			.values(urls.map((url) => ({ mediaId, url })))
			.onConflictDoNothing({
				target: [mediaUrls.mediaId, mediaUrls.url],
			})
			.returning();
		return rows.map(toMediaUrl);
	},

	async findAllPathsBySourceId(
		sourceId: string,
		tx?: TauriDbExecutor,
	): Promise<Array<{ id: string; filePath: string }>> {
		return await getExecutor(tx)
			.select({
				id: medias.id,
				filePath: medias.filePath,
			})
			.from(medias)
			.where(eq(medias.mediaSourceId, sourceId));
	},

	async findAllMediaIndices(
		sourceId?: string,
		options?: { limit?: number; offset?: number },
		tx?: TauriDbExecutor,
	): Promise<Array<{ id: string; mediaSourceId: string; filePath: string }>> {
		const conditions = sourceId ? [eq(medias.mediaSourceId, sourceId)] : [];
		let query = getExecutor(tx)
			.select({
				id: medias.id,
				mediaSourceId: medias.mediaSourceId,
				filePath: medias.filePath,
			})
			.from(medias)
			.where(and(...conditions))
			.$dynamic();

		if (options?.limit) {
			query = query.limit(options.limit);
		}
		if (options?.offset) {
			query = query.offset(options.offset);
		}

		return await query;
	},

	async findIdsWithMissingGenerationInfo(
		tx?: TauriDbExecutor,
	): Promise<Array<{ id: string; mediaSourceId: string; filePath: string }>> {
		// PostgreSQL/SQLite compatible LEFT JOIN query to find media without generation info
		return await getExecutor(tx)
			.select({
				id: medias.id,
				mediaSourceId: medias.mediaSourceId,
				filePath: medias.filePath,
			})
			.from(medias)
			.leftJoin(
				mediaGenerationInfo,
				eq(medias.id, mediaGenerationInfo.mediaId),
			)
			.where(sql`${mediaGenerationInfo.mediaId} IS NULL`);
	},

	async deleteBySourceIdAndPathPrefix(
		sourceId: string,
		folderPath: string,
		tx?: TauriDbExecutor,
	): Promise<Array<{ id: string; filePath: string }>> {
		const normalizedFolderPath = folderPath.replace(/[\\/]+$/, "");
		if (!normalizedFolderPath) {
			return [];
		}

		const prefixPattern = `${escapeLikePattern(normalizedFolderPath)}/`;
		return await getExecutor(tx)
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
			.returning({
				id: medias.id,
				filePath: medias.filePath,
			});
	},

	async batchUpsert(
		inputs: UpsertTauriMediaInput[],
		tx?: TauriDbExecutor,
	): Promise<Array<{ id: string; filePath: string }>> {
		if (inputs.length === 0) return [];
		const now = new Date();
		return await getExecutor(tx)
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
			.returning({ id: medias.id, filePath: medias.filePath });
	},
};

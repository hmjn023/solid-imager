import {
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	type AddMediaRequest,
	type Author,
	type Media,
	type MediaDetails,
	type MediaGenerationInfo,
	type MediaSearchRequest,
	type MediaSearchResponse,
	type MediaTag,
	type MediaUrl,
	mediaSearchResponseSchema,
	type UpdateMediaRequest,
} from "@solid-imager/core/domain/media/schemas";
import type {
	SearchGroup,
	SearchCriterion,
} from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { TagRepository as TagRepositoryType } from "@solid-imager/core/domain/repositories/tag-repository";
import {
	and,
	asc,
	desc,
	eq,
	exists,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	not,
	notInArray,
	or,
	sql,
	type AnyColumn,
	type InferSelectModel,
	type SQL,
} from "drizzle-orm";
import {
	authors,
	characters,
	ips,
	mediaAuthors,
	mediaCharacters,
	mediaDetails,
	mediaGenerationInfo,
	mediaIps,
	mediaProjects,
	medias,
	mediaTags,
	mediaUrls,
	type NewMedia,
	projects,
	tags,
} from "../schema";
import type { DrizzleExecutor } from "../types";
import type { createMediaSearchFunctions } from "./media-repository-utils";

// ============================================================================
// Types
// ============================================================================

type DbMedia = InferSelectModel<typeof medias>;
type DbMediaUrl = InferSelectModel<typeof mediaUrls>;
type CriterionValue = SearchCriterion["value"];

type MediaWithRelations = InferSelectModel<typeof medias> & {
	tags: (InferSelectModel<typeof mediaTags> & {
		tag: InferSelectModel<typeof tags>;
	})[];
	generationInfo: InferSelectModel<typeof mediaGenerationInfo> | null;
	authors: (InferSelectModel<typeof mediaAuthors> & {
		author: InferSelectModel<typeof authors>;
	})[];
	urls: InferSelectModel<typeof mediaUrls>[];
	characters: (InferSelectModel<typeof mediaCharacters> & {
		character: InferSelectModel<typeof characters>;
	})[];
	ips: (InferSelectModel<typeof mediaIps> & {
		ip: InferSelectModel<typeof ips>;
	})[];
};

const DEFAULT_LIMIT = 100;
const DEFAULT_OFFSET = 0;

// ============================================================================
// Mapping Functions
// ============================================================================

function mapToMedia(dbMedia: DbMedia): Media {
	return {
		id: dbMedia.id,
		mediaSourceId: dbMedia.mediaSourceId,
		filePath: dbMedia.filePath,
		fileName: dbMedia.fileName,
		mediaType: dbMedia.mediaType,
		width: dbMedia.width,
		height: dbMedia.height,
		fileSize: dbMedia.fileSize,
		description: dbMedia.description,
		createdAt: dbMedia.createdAt,
		modifiedAt: dbMedia.modifiedAt,
		indexedAt: dbMedia.indexedAt,
		status: dbMedia.status as Media["status"],
	};
}

function mapToMediaUrl(dbUrl: DbMediaUrl): MediaUrl {
	return {
		id: dbUrl.id,
		mediaId: dbUrl.mediaId,
		url: dbUrl.url,
		createdAt: dbUrl.createdAt,
		updatedAt: dbUrl.updatedAt,
	};
}

function mapToMediaDetails(row: MediaWithRelations): MediaDetails {
	return {
		...mapToMedia(row),
		tags: row.tags.map((mt) => ({
			...mt.tag,
			type: mt.tagType,
			source: mt.source,
			confidence: mt.confidence,
		})),
		generationInfo: row.generationInfo
			? {
					...row.generationInfo,
					aiGenerated: row.generationInfo.aiGenerated ?? false,
					modelName: row.generationInfo.modelName ?? "",
					seed: row.generationInfo.seed ?? -1,
					cfgScale: row.generationInfo.cfgScale ?? 0,
					steps: row.generationInfo.steps ?? 0,
				}
			: null,
		authors: row.authors.map((ma) => ma.author),
		urls: row.urls.map(mapToMediaUrl),
		characters: row.characters.map((mc) => ({
			...mc.character,
			confidence: mc.confidence,
			linkSource: mc.source,
		})),
		ips: row.ips.map((mi) => ({
			...mi.ip,
			confidence: mi.confidence,
			linkSource: mi.source,
		})),
	};
}

// ============================================================================
// Query Builder Helper Factories (closed over getExecutor)
// ============================================================================

function escapeLikePattern(value: string): string {
	return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function getColumnForTarget(target: string): AnyColumn | undefined {
	switch (target) {
		case "fileName":
			return medias.fileName;
		case "filePath":
			return medias.filePath;
		case "description":
			return medias.description;
		case "mediaType":
			return medias.mediaType;
		case "width":
			return medias.width;
		case "height":
			return medias.height;
		case "fileSize":
			return medias.fileSize;
		case "createdAt":
			return medias.createdAt;
		case "rating":
			return mediaDetails.rating;
		case "favorite":
			return mediaDetails.favorite;
		case "viewCount":
			return mediaDetails.viewCount;
		case "aiGenerated":
			return mediaGenerationInfo.aiGenerated;
		default:
			return;
	}
}

function buildValueCondition(
	column: AnyColumn,
	operator: string,
	value: CriterionValue,
): SQL | undefined {
	if (value === null && operator === "equals") {
		return isNull(column);
	}
	if (value === null && operator !== "isEmpty" && operator !== "isNotEmpty") {
		return;
	}

	switch (operator) {
		case "equals":
			return eq(column, value);
		case "contains":
			return like(column, `%${escapeLikePattern(String(value))}%`);
		case "startsWith":
			return like(column, `${escapeLikePattern(String(value))}%`);
		case "endsWith":
			return like(column, `%${escapeLikePattern(String(value))}`);
		case "gt":
			return gt(column, value);
		case "gte":
			return gte(column, value);
		case "lt":
			return lt(column, value);
		case "lte":
			return lte(column, value);
		case "in":
			return Array.isArray(value) ? inArray(column, value) : undefined;
		case "notIn":
			return Array.isArray(value) ? notInArray(column, value) : undefined;
		case "isEmpty":
			return isNull(column);
		case "isNotEmpty":
			return isNotNull(column);
		default:
			return;
	}
}

function makeBuildKeywordCondition(getExecutor: (tx?: unknown) => DrizzleExecutor) {
	return (node: SearchCriterion): SQL | undefined => {
		const pattern = `%${escapeLikePattern(String(node.value))}%`;
		const condition = or(
			like(medias.fileName, pattern),
			like(medias.filePath, pattern),
			like(medias.description, pattern),
			exists(
				getExecutor()
					.select({ id: mediaGenerationInfo.mediaId })
					.from(mediaGenerationInfo)
					.where(
						and(
							eq(mediaGenerationInfo.mediaId, medias.id),
							like(mediaGenerationInfo.prompt, pattern),
						),
					),
			),
		);
		if (!condition) {
			return;
		}
		return node.negate ? not(condition) : condition;
	};
}

function makeBuildRelationQuery(getExecutor: (tx?: unknown) => DrizzleExecutor) {
	return (
		target: "tag" | "project" | "ip" | "character" | "author",
		operator: SearchCriterion["operator"],
		value: string | number | boolean,
		negate: boolean,
	): SQL | undefined => {
		let subquery: SQL | undefined;

		switch (target) {
			case "tag":
				subquery = exists(
					getExecutor()
						.select({ id: mediaTags.mediaId })
						.from(mediaTags)
						.innerJoin(tags, eq(mediaTags.tagId, tags.id))
						.where(
							and(
								eq(mediaTags.mediaId, medias.id),
								buildValueCondition(tags.name, operator, value),
							),
						),
				);
				break;
			case "project":
				subquery = exists(
					getExecutor()
						.select({ id: mediaProjects.mediaId })
						.from(mediaProjects)
						.innerJoin(projects, eq(mediaProjects.projectId, projects.id))
						.where(
							and(
								eq(mediaProjects.mediaId, medias.id),
								buildValueCondition(projects.name, operator, value),
							),
						),
				);
				break;
			case "ip":
				subquery = exists(
					getExecutor()
						.select({ id: mediaIps.mediaId })
						.from(mediaIps)
						.innerJoin(ips, eq(mediaIps.ipId, ips.id))
						.where(
							and(
								eq(mediaIps.mediaId, medias.id),
								buildValueCondition(ips.name, operator, value),
							),
						),
				);
				break;
			case "character":
				subquery = exists(
					getExecutor()
						.select({ id: mediaCharacters.mediaId })
						.from(mediaCharacters)
						.innerJoin(characters, eq(mediaCharacters.characterId, characters.id))
						.where(
							and(
								eq(mediaCharacters.mediaId, medias.id),
								buildValueCondition(characters.name, operator, value),
							),
						),
				);
				break;
			case "author":
				subquery = exists(
					getExecutor()
						.select({ id: mediaAuthors.mediaId })
						.from(mediaAuthors)
						.innerJoin(authors, eq(mediaAuthors.authorId, authors.id))
						.where(
							and(
								eq(mediaAuthors.mediaId, medias.id),
								buildValueCondition(authors.name, operator, value),
							),
						),
				);
				break;
			default:
				return;
		}

		if (!subquery) {
			return;
		}

		return negate ? not(subquery) : subquery;
	};
}

function makeBuildDetailsQuery(getExecutor: (tx?: unknown) => DrizzleExecutor) {
	return (
		target: string,
		operator: string,
		value: CriterionValue,
		negate?: boolean,
	): SQL | undefined => {
		let column: AnyColumn | undefined;
		if (target === "rating") {
			column = mediaDetails.rating;
		}
		if (target === "favorite") {
			column = mediaDetails.favorite;
		}
		if (target === "viewCount") {
			column = mediaDetails.viewCount;
		}

		if (!column) {
			return;
		}

		const condition = exists(
			getExecutor()
				.select({ one: sql`1` })
				.from(mediaDetails)
				.where(
					and(
						eq(mediaDetails.mediaId, medias.id),
						buildValueCondition(column, operator, value),
					),
				),
		);

		if (!condition) {
			return;
		}
		return negate ? not(condition) : condition;
	};
}

function makeBuildGenerationInfoQuery(getExecutor: (tx?: unknown) => DrizzleExecutor) {
	return (
		_target: string,
		operator: string,
		value: CriterionValue,
		negate?: boolean,
	): SQL | undefined => {
		const column = mediaGenerationInfo.aiGenerated;
		const condition = exists(
			getExecutor()
				.select({ one: sql`1` })
				.from(mediaGenerationInfo)
				.where(
					and(
						eq(mediaGenerationInfo.mediaId, medias.id),
						buildValueCondition(column, operator, value),
					),
				),
		);

		if (!condition) {
			return;
		}
		return negate ? not(condition) : condition;
	};
}

function makeBuildCriterionQuery(getExecutor: (tx?: unknown) => DrizzleExecutor) {
	const buildKeywordCondition = makeBuildKeywordCondition(getExecutor);
	const buildRelationQuery = makeBuildRelationQuery(getExecutor);
	const buildDetailsQuery = makeBuildDetailsQuery(getExecutor);
	const buildGenerationInfoQuery = makeBuildGenerationInfoQuery(getExecutor);

	return (node: SearchCriterion): SQL | undefined => {
		const { target } = node;

		if (target === "keyword") {
			return buildKeywordCondition(node);
		}

		const relationalTargets = ["tag", "project", "ip", "character", "author"];
		if (relationalTargets.includes(target)) {
			return buildRelationQuery(
				target as "tag" | "project" | "ip" | "character" | "author",
				node.operator,
				node.value as string,
				node.negate ?? false,
			);
		}

		if (target === "folder") {
			if (typeof node.value !== "string") {
				return;
			}
			const folderPath = node.value.endsWith("/") ? node.value : `${node.value}/`;
			const pattern = `${escapeLikePattern(folderPath)}%`;
			const condition = like(medias.filePath, pattern);
			return node.negate ? not(condition) : condition;
		}

		if (["rating", "favorite", "viewCount"].includes(target)) {
			return buildDetailsQuery(
				target,
				node.operator,
				node.value,
				node.negate ?? false,
			);
		}

		if (target === "aiGenerated") {
			return buildGenerationInfoQuery(
				target,
				node.operator,
				node.value,
				node.negate ?? false,
			);
		}

		return buildStandardQuery(
			target,
			node.operator,
			node.value,
			node.negate ?? false,
		);
	};
}

function buildStandardQuery(
	target: string,
	operator: string,
	value: CriterionValue,
	negate?: boolean,
): SQL | undefined {
	const column = getColumnForTarget(target);
	if (!column) {
		return;
	}

	const condition = buildValueCondition(column, operator, value);
	if (!condition) {
		return;
	}

	return negate ? not(condition) : condition;
}

function makeBuildSearchQuery(getExecutor: (tx?: unknown) => DrizzleExecutor) {
	const buildCriterionQuery = makeBuildCriterionQuery(getExecutor);

	const buildSearchQueryInner = (
		node: SearchGroup | SearchCriterion,
		depth = 0,
	): SQL | undefined => {
		const MaxDepth = 10;
		if (depth > MaxDepth) {
			throw new Error(`Search condition nesting too deep (max ${MaxDepth})`);
		}

		if (node.type === "group") {
			const children = node.children as any[];
			const conditions = children
				.map((child) => buildSearchQueryInner(child, depth + 1))
				.filter((c): c is SQL => c !== undefined);

			if (conditions.length === 0) {
				return;
			}

			const combined =
				node.operator === "and" ? and(...conditions) : or(...conditions);

			if (!combined) {
				return;
			}

			return node.negate ? not(combined) : combined;
		}

		return buildCriterionQuery(node);
	};

	return buildSearchQueryInner;
}

function getOrderByClause(sort: string | undefined, order: "asc" | "desc") {
	const direction = order === "asc" ? asc : desc;

	if (!sort) {
		return direction(medias.createdAt);
	}

	switch (sort) {
		case "name":
			return direction(medias.fileName);
		case "size":
			return direction(medias.fileSize);
		case "date":
			return direction(medias.createdAt);
		case "rating":
			return direction(mediaDetails.rating);
		case "viewCount":
			return direction(mediaDetails.viewCount);
		default:
			return direction(medias.createdAt);
	}
}

function makeExecuteSearch(getExecutor: (tx?: unknown) => DrizzleExecutor) {
	return async (
		params: MediaSearchRequest,
		mediaSourceId?: string,
		tx?: Transaction,
	): Promise<MediaSearchResponse> => {
		const client = getExecutor(tx);
		const getExecutorWithTx = (innerTx?: unknown) => getExecutor(innerTx ?? tx);
		const buildSearchQuery = makeBuildSearchQuery(getExecutorWithTx);

		const conditions: SQL[] = [];
		if (mediaSourceId) {
			conditions.push(eq(medias.mediaSourceId, mediaSourceId));
		}

		if (params.condition) {
			const searchCondition = buildSearchQuery(params.condition);
			if (searchCondition) {
				conditions.push(searchCondition);
			}
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Optimized sort: Join only if sorting by detail fields
		const needsDetailsJoin = ["rating", "viewCount"].includes(params.sort ?? "");

		let query = client
			.select({
				media: medias,
				totalCount: sql<number>`count(*) over()`,
			})
			.from(medias);

		if (needsDetailsJoin) {
			query = query.leftJoin(
				mediaDetails,
				eq(mediaDetails.mediaId, medias.id),
			) as any;
		}

		const orderBy = getOrderByClause(params.sort, params.order);

		const result = await query
			.where(whereClause)
			.limit(params.limit ?? DEFAULT_LIMIT)
			.offset(params.offset ?? DEFAULT_OFFSET)
			.orderBy(orderBy);

		const total =
			result.length > 0
				? Number(result[0].totalCount)
				: Number(
						(
							await client
								.select({ count: sql<number>`count(*)` })
								.from(medias)
								.where(whereClause)
						)[0].count,
					);

		return mediaSearchResponseSchema.parse({
			media: result.map((row) => mapToMedia(row.media)),
			total,
		});
	};
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMediaRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
	deps?: {
		logger?: { info?(data: unknown, msg?: string): void; error?(data: unknown, msg?: string): void };
		authorRepository?: import("@solid-imager/core/domain/repositories/author-repository").IAuthorRepository;
		tagRepository?: TagRepositoryType;
		mediaSearch?: ReturnType<typeof createMediaSearchFunctions>;
	},
): IMediaRepository {
	const executeSearch = makeExecuteSearch(getExecutor);

	return {
		/**
		 * Retrieves a specific media item by its ID.
		 */
		async findById(mediaId: string, tx?: Transaction): Promise<Media | null> {
			try {
				const client = getExecutor(tx);
				const result = await client
					.select()
					.from(medias)
					.where(eq(medias.id, mediaId));
				if (result.length === 0) {
					return null;
				}
				return mapToMedia(result[0]);
			} catch (e) {
				if (e instanceof ResourceNotFoundError) {
					return null;
				}
				throw new UnexpectedError(`Failed to select media by ID: ${mediaId}`, e);
			}
		},

		/**
		 * Retrieves a specific media item by Source ID and File Path.
		 */
		async findByPath(
			sourceId: string,
			filePath: string,
			tx?: Transaction,
		): Promise<Media | null> {
			try {
				const client = getExecutor(tx);
				const result = await client
					.select()
					.from(medias)
					.where(
						and(
							eq(medias.mediaSourceId, sourceId),
							eq(medias.filePath, filePath),
						),
					);
				if (result.length === 0) {
					return null;
				}
				return mapToMedia(result[0]);
			} catch (error) {
				throw new UnexpectedError(
					"Failed to select media by source ID and file path",
					error,
				);
			}
		},

		/**
		 * Creates a new media entry in the database.
		 */
		async create(media: AddMediaRequest, tx?: Transaction): Promise<Media> {
			try {
				const client = getExecutor(tx);
				const newMedia: NewMedia = {
					...media,
					status: "active",
					indexedAt: new Date(),
				};
				const result = await client.insert(medias).values(newMedia).returning();
				return mapToMedia(result[0]);
			} catch (error) {
				throw new UnexpectedError("Failed to insert media", error);
			}
		},

		/**
		 * Upserts a media entry in the database.
		 */
		async upsert(media: AddMediaRequest, tx?: Transaction): Promise<Media> {
			try {
				const client = getExecutor(tx);
				const newMedia: NewMedia = {
					...media,
					status: "active",
					indexedAt: new Date(),
				};
				const result = await client
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
				return mapToMedia(result[0]);
			} catch (error) {
				throw new UnexpectedError("Failed to upsert media", error);
			}
		},

		/**
		 * Updates an existing media entry.
		 */
		async update(
			mediaId: string,
			updates: UpdateMediaRequest,
			tx?: Transaction,
		): Promise<Media> {
			try {
				const client = getExecutor(tx);
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

				dbUpdates.modifiedAt = updates.modifiedAt || new Date();

				const result = await client
					.update(medias)
					.set(dbUpdates)
					.where(eq(medias.id, mediaId))
					.returning();

				if (result.length === 0) {
					throw new ResourceNotFoundError("Media", mediaId);
				}
				return mapToMedia(result[0]);
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(
					`Failed to update media with ID: ${mediaId}`,
					error,
				);
			}
		},

		/**
		 * Deletes a media entry from the database.
		 */
		async delete(mediaId: string, tx?: Transaction): Promise<void> {
			try {
				const client = getExecutor(tx);
				const result = await client
					.delete(medias)
					.where(eq(medias.id, mediaId))
					.returning();
				if (result.length === 0) {
					throw new ResourceNotFoundError("Media", mediaId);
				}
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(
					`Failed to delete media with ID: ${mediaId}`,
					error,
				);
			}
		},

		/**
		 * Searches for media based on criteria using recursive query builder.
		 */
		search(
			mediaSourceId: string,
			params: MediaSearchRequest,
			tx?: Transaction,
		): Promise<MediaSearchResponse> {
			return executeSearch(params, mediaSourceId, tx);
		},

		globalSearch(
			params: MediaSearchRequest,
			tx?: Transaction,
		): Promise<MediaSearchResponse> {
			return executeSearch(params, undefined, tx);
		},

		/**
		 * Optimized: Fetch media and all relations in a single query using Drizzle's relational query builder.
		 * This avoids N+1 query issues (or N+4 in this case) when fetching details.
		 */
		async getDetails(
			mediaId: string,
			tx?: Transaction,
		): Promise<MediaDetails | null> {
			try {
				const client = getExecutor(tx);
				const result = await (client as any).query.medias.findFirst({
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

				if (!result) {
					return null;
				}

				return mapToMediaDetails(result);
			} catch (error) {
				throw new UnexpectedError(
					`Failed to get media details for mediaId: ${mediaId}`,
					error,
				);
			}
		},

		async getTags(mediaId: string, tx?: Transaction): Promise<MediaTag[]> {
			const tagRepo = deps?.tagRepository;
			if (tagRepo) {
				return await tagRepo.findByMediaId(mediaId, tx);
			}
			// Fallback: query directly
			const client = getExecutor(tx);
			const rows = await client
				.select()
				.from(mediaTags)
				.innerJoin(tags, eq(mediaTags.tagId, tags.id))
				.where(eq(mediaTags.mediaId, mediaId));
			return rows.map((r) => ({
				...r.tags,
				type: r.media_tags.tagType,
				source: r.media_tags.source,
				confidence: r.media_tags.confidence,
			})) as unknown as MediaTag[];
		},

		async getGenerationInfo(
			mediaId: string,
			tx?: Transaction,
		): Promise<MediaGenerationInfo | null> {
			try {
				const client = getExecutor(tx);
				const result = await client
					.select()
					.from(mediaGenerationInfo)
					.where(eq(mediaGenerationInfo.mediaId, mediaId));
				if (result.length === 0) {
					return null;
				}
				const info = result[0];
				return {
					...info,
					aiGenerated: info.aiGenerated ?? false,
					modelName: info.modelName ?? "",
					seed: info.seed ?? -1,
					cfgScale: info.cfgScale ?? 0,
					steps: info.steps ?? 0,
				};
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select media generation info for mediaId: ${mediaId}`,
					error,
				);
			}
		},

		async getAuthors(mediaId: string, tx?: Transaction): Promise<Author[]> {
			const authorRepo = deps?.authorRepository;
			if (authorRepo) {
				return await authorRepo.findByMediaId(mediaId, tx);
			}
			// Fallback: query directly
			const client = getExecutor(tx);
			const rows = await client
				.select({
					id: authors.id,
					name: authors.name,
					accountId: authors.accountId,
					createdAt: authors.createdAt,
					updatedAt: authors.updatedAt,
				})
				.from(mediaAuthors)
				.innerJoin(authors, eq(mediaAuthors.authorId, authors.id))
				.where(eq(mediaAuthors.mediaId, mediaId));
			return rows.map((r) => ({
				id: r.id,
				name: r.name,
				accountId: r.accountId,
				createdAt: r.createdAt,
				updatedAt: r.updatedAt,
			}));
		},

		async getUrls(mediaId: string, tx?: Transaction): Promise<MediaUrl[]> {
			try {
				const client = getExecutor(tx);
				const results = await client
					.select()
					.from(mediaUrls)
					.where(eq(mediaUrls.mediaId, mediaId));
				return results.map(mapToMediaUrl);
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select media URLs for mediaId: ${mediaId}`,
					error,
				);
			}
		},

		async addUrls(
			mediaId: string,
			urls: string[],
			tx?: Transaction,
		): Promise<MediaUrl[]> {
			if (urls.length === 0) {
				return [];
			}
			try {
				const client = getExecutor(tx);
				const values = urls.map((url) => ({
					mediaId,
					url,
				}));
				const results = await client
					.insert(mediaUrls)
					.values(values)
					.onConflictDoNothing({
						target: [mediaUrls.mediaId, mediaUrls.url],
					})
					.returning();
				return results.map(mapToMediaUrl);
			} catch (error) {
				throw new UnexpectedError("Failed to insert media URLs", error);
			}
		},

		async upsertGenerationInfo(
			mediaId: string,
			prompt: string | null,
			workflow: unknown,
			tx?: Transaction,
		): Promise<MediaGenerationInfo> {
			try {
				const client = getExecutor(tx);
				const values = {
					mediaId,
					prompt,
					workflow,
					metadata: { prompt },
				};
				const result = await client
					.insert(mediaGenerationInfo)
					.values(values)
					.onConflictDoUpdate({
						target: mediaGenerationInfo.mediaId,
						set: values,
					})
					.returning();
				const info = result[0];
				return {
					...info,
					aiGenerated: info.aiGenerated ?? false,
					modelName: info.modelName ?? "",
					seed: info.seed ?? -1,
					cfgScale: info.cfgScale ?? 0,
					steps: info.steps ?? 0,
				};
			} catch (error) {
				throw new UnexpectedError(
					`Failed to upsert media generation info for mediaId: ${mediaId}`,
					error,
				);
			}
		},

		// Bulk
		async findAllBySourceId(
			mediaSourceId: string,
			limit = 100,
			offset = 0,
			tx?: Transaction,
		): Promise<Media[]> {
			try {
				const client = getExecutor(tx);
				const query = client
					.select()
					.from(medias)
					.where(eq(medias.mediaSourceId, mediaSourceId))
					.limit(limit)
					.offset(offset);
				const results = await query;
				return results.map(mapToMedia);
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select medias by source ID: ${mediaSourceId}`,
					error,
				);
			}
		},

		async searchInDirectory(
			mediaSourceId: string,
			directoryPath: string,
			params: { query?: string; tags?: string[] },
			tx?: Transaction,
		): Promise<Media[]> {
			const mediaSearch = deps?.mediaSearch;
			if (mediaSearch) {
				const results = await mediaSearch.searchMediaInDirectory(
					mediaSourceId,
					directoryPath,
					params,
				);
				return results.map(mapToMedia);
			}
			// Fallback: basic direct query
			const client = getExecutor(tx);
			const pattern = `${directoryPath.endsWith("/") ? directoryPath : `${directoryPath}/`}%`;
			const conditions: import("drizzle-orm").SQL[] = [
				eq(medias.mediaSourceId, mediaSourceId),
				like(medias.filePath, pattern),
			];
			const results = await client
				.select()
				.from(medias)
				.where(and(...conditions));
			return results.map(mapToMedia);
		},

		async findExistingUrls(urls: string[], tx?: Transaction): Promise<string[]> {
			if (urls.length === 0) {
				return [];
			}
			const client = getExecutor(tx);
			try {
				const results = await client
					.select({ url: mediaUrls.url })
					.from(mediaUrls)
					.where(inArray(mediaUrls.url, urls));
				return results.map((r) => r.url);
			} catch (error) {
				throw new UnexpectedError("Failed to check existing URLs", error);
			}
		},

		async findIdsWithMissingGenerationInfo(
			tx?: Transaction,
		): Promise<{ id: string; mediaSourceId: string; filePath: string }[]> {
			const client = getExecutor(tx);
			return await client
				.select({
					id: medias.id,
					mediaSourceId: medias.mediaSourceId,
					filePath: medias.filePath,
				})
				.from(medias)
				.leftJoin(mediaGenerationInfo, eq(medias.id, mediaGenerationInfo.mediaId))
				.where(
					and(eq(medias.status, "active"), isNull(mediaGenerationInfo.mediaId)),
				);
		},

		async findAllMediaIndices(
			tx?: Transaction,
			options?: { limit: number; offset: number },
		): Promise<{ id: string; mediaSourceId: string; filePath: string }[]> {
			const client = getExecutor(tx);
			let query = client
				.select({
					id: medias.id,
					mediaSourceId: medias.mediaSourceId,
					filePath: medias.filePath,
				})
				.from(medias)
				.where(eq(medias.status, "active"))
				.$dynamic();

			if (options) {
				query = query.limit(options.limit).offset(options.offset);
			}

			return await query;
		},

		async findAllPathsBySourceId(
			mediaSourceId: string,
			tx?: Transaction,
		): Promise<{ id: string; filePath: string }[]> {
			try {
				const client = getExecutor(tx);
				return await client
					.select({
						id: medias.id,
						filePath: medias.filePath,
					})
					.from(medias)
					.where(eq(medias.mediaSourceId, mediaSourceId));
			} catch (error) {
				if (deps?.logger?.error) {
					deps.logger.error(
						{ error, mediaSourceId },
						"Database error in findAllPathsBySourceId",
					);
				}
				throw new UnexpectedError(
					`Failed to select media paths by source ID: ${mediaSourceId}`,
					error,
				);
			}
		},
	};
}

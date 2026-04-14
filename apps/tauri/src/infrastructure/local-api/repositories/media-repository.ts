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
	SearchCriterion,
	SearchGroup,
	UpdateMediaRequest,
} from "@solid-imager/core/domain/media/schemas";
import {
	mediaDetailsSchema,
	mediaGenerationInfoSchema,
	mediaSchema,
	mediaSearchResponseSchema,
	mediaUrlSchema,
	tagSchema,
} from "@solid-imager/core/domain/media/schemas";
import type { AnyColumn } from "drizzle-orm";
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
	type SQL,
	sql,
} from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";
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
	projects,
	tags,
} from "../../../../../server/src/infrastructure/db/schema";

function getExecutor(tx?: TauriDbExecutor) {
	return tx ?? getTauriAppServices().db;
}

function getDb() {
	return getTauriAppServices().db;
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

type CriterionValue = SearchCriterion["value"];

function escapeLikePattern(value: string) {
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

function buildKeywordCondition(node: SearchCriterion): SQL | undefined {
	const pattern = `%${escapeLikePattern(String(node.value))}%`;
	const condition = or(
		like(medias.fileName, pattern),
		like(medias.filePath, pattern),
		like(medias.description, pattern),
		exists(
			getDb()
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
}

function buildRelationQuery(
	target: "tag" | "project" | "ip" | "character" | "author",
	operator: SearchCriterion["operator"],
	value: string | number | boolean,
	negate: boolean,
): SQL | undefined {
	let subquery: SQL | undefined;

	switch (target) {
		case "tag":
			subquery = exists(
				getDb()
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
				getDb()
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
				getDb()
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
				getDb()
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
				getDb()
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
}

function buildRelationCondition(node: SearchCriterion): SQL | undefined {
	return buildRelationQuery(
		node.target as "tag" | "project" | "ip" | "character" | "author",
		node.operator,
		node.value as string,
		node.negate ?? false,
	);
}

function buildFolderCondition(node: SearchCriterion): SQL | undefined {
	if (typeof node.value !== "string") {
		return;
	}
	const folderPath = node.value.endsWith("/") ? node.value : `${node.value}/`;
	const pattern = `${escapeLikePattern(folderPath)}%`;
	const condition = like(medias.filePath, pattern);
	return node.negate ? not(condition) : condition;
}

function buildDetailsQuery(
	target: string,
	operator: string,
	value: CriterionValue,
	negate?: boolean,
): SQL | undefined {
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
		getDb()
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
}

function buildGenerationInfoQuery(
	operator: string,
	value: CriterionValue,
	negate?: boolean,
): SQL | undefined {
	const condition = exists(
		getDb()
			.select({ one: sql`1` })
			.from(mediaGenerationInfo)
			.where(
				and(
					eq(mediaGenerationInfo.mediaId, medias.id),
					buildValueCondition(mediaGenerationInfo.aiGenerated, operator, value),
				),
			),
	);
	if (!condition) {
		return;
	}
	return negate ? not(condition) : condition;
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

function buildCriterionQuery(node: SearchCriterion): SQL | undefined {
	if (node.target === "keyword") {
		return buildKeywordCondition(node);
	}
	if (["tag", "project", "ip", "character", "author"].includes(node.target)) {
		return buildRelationCondition(node);
	}
	if (node.target === "folder") {
		return buildFolderCondition(node);
	}
	if (["rating", "favorite", "viewCount"].includes(node.target)) {
		return buildDetailsQuery(
			node.target,
			node.operator,
			node.value,
			node.negate ?? false,
		);
	}
	if (node.target === "aiGenerated") {
		return buildGenerationInfoQuery(
			node.operator,
			node.value,
			node.negate ?? false,
		);
	}
	return buildStandardQuery(
		node.target,
		node.operator,
		node.value,
		node.negate ?? false,
	);
}

function buildSearchQuery(
	node: SearchGroup | SearchCriterion,
	depth = 0,
): SQL | undefined {
	if (depth > 10) {
		throw new Error("Search condition nesting too deep");
	}

	if (node.type === "group") {
		const conditions = node.children
			.map((child) => buildSearchQuery(child, depth + 1))
			.filter((value): value is SQL => value !== undefined);
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
}

function getOrderByClause(sort: string | undefined, order: "asc" | "desc") {
	const direction = order === "asc" ? asc : desc;

	switch (sort) {
		case "name":
			return direction(medias.fileName);
		case "size":
			return direction(medias.fileSize);
		case "rating":
			return direction(mediaDetails.rating);
		case "viewCount":
			return direction(mediaDetails.viewCount);
		default:
			return direction(medias.createdAt);
	}
}

async function executeSearch(
	params: MediaSearchRequest,
	mediaSourceId?: string,
	tx?: TauriDbExecutor,
): Promise<MediaSearchResponse> {
	const client = getExecutor(tx);
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
	const needsDetailsJoin = ["rating", "viewCount"].includes(params.sort ?? "");

	let query = client
		.select({
			media: medias,
		})
		.from(medias);

	if (needsDetailsJoin) {
		query = query.leftJoin(
			mediaDetails,
			eq(mediaDetails.mediaId, medias.id),
		) as any;
	}

	const rows = await query
		.where(whereClause)
		.limit(params.limit ?? 100)
		.offset(params.offset ?? 0)
		.orderBy(getOrderByClause(params.sort, params.order));

	const countRows = await client
		.select({ count: sql<number>`count(*)` })
		.from(medias)
		.where(whereClause);

	return mediaSearchResponseSchema.parse({
		media: rows.map((row) => toMedia(row.media)),
		total: Number(countRows[0]?.count ?? 0),
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
};

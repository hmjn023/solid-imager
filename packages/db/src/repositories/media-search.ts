import { UnexpectedError } from "@solid-imager/core/domain/errors";
import type {
	Media,
	MediaSearchRequest,
	MediaSearchResponse,
	SearchCriterion,
	SearchGroup,
} from "@solid-imager/core/domain/media/schemas";
import { mediaSearchResponseSchema } from "@solid-imager/core/domain/media/schemas";
import type { AnyColumn, SQL } from "drizzle-orm";
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
	projects,
	tags,
} from "../schema";
import type { DrizzleExecutor } from "../types";

type CriterionValue = SearchCriterion["value"];

export type ExecuteMediaSearchOptions = {
	client: DrizzleExecutor;
	params: MediaSearchRequest;
	mediaSourceId?: string;
	mapMedia: (row: typeof medias.$inferSelect) => Media;
	defaultLimit?: number;
	defaultOffset?: number;
};

export type ExecuteMediaSearchInDirectoryOptions = {
	client: DrizzleExecutor;
	mediaSourceId: string;
	directoryPath: string;
	params: {
		query?: string;
		tags?: string[];
	};
	mapMedia: (row: typeof medias.$inferSelect) => Media;
};

function escapeLikePattern(value: string): string {
	return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		value,
	);
}

function isUuidArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((v) => typeof v === "string" && isUuid(v))
	);
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

function buildKeywordCondition(
	client: DrizzleExecutor,
	node: SearchCriterion,
): SQL | undefined {
	const pattern = `%${escapeLikePattern(String(node.value))}%`;
	const condition = or(
		like(medias.fileName, pattern),
		like(medias.filePath, pattern),
		like(medias.description, pattern),
		exists(
			client
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

function getRelationColumn(
	target: "tag" | "project" | "ip" | "character" | "author",
	value: string | number | boolean,
): AnyColumn {
	switch (target) {
		case "tag":
			return tags.name;
		case "project":
			return isUuid(String(value)) || isUuidArray(value)
				? projects.id
				: projects.name;
		case "ip":
			return isUuid(String(value)) || isUuidArray(value) ? ips.id : ips.name;
		case "character":
			return isUuid(String(value)) || isUuidArray(value)
				? characters.id
				: characters.name;
		case "author":
			return authors.name;
	}
}

function buildRelationQuery(
	client: DrizzleExecutor,
	target: "tag" | "project" | "ip" | "character" | "author",
	operator: SearchCriterion["operator"],
	value: string | number | boolean,
	negate: boolean,
): SQL | undefined {
	let subquery: SQL | undefined;

	switch (target) {
		case "tag":
			subquery = exists(
				client
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
				client
					.select({ id: mediaProjects.mediaId })
					.from(mediaProjects)
					.innerJoin(projects, eq(mediaProjects.projectId, projects.id))
					.where(
						and(
							eq(mediaProjects.mediaId, medias.id),
							buildValueCondition(
								getRelationColumn(target, value),
								operator,
								value,
							),
						),
					),
			);
			break;
		case "ip":
			subquery = exists(
				client
					.select({ id: mediaIps.mediaId })
					.from(mediaIps)
					.innerJoin(ips, eq(mediaIps.ipId, ips.id))
					.where(
						and(
							eq(mediaIps.mediaId, medias.id),
							buildValueCondition(
								getRelationColumn(target, value),
								operator,
								value,
							),
						),
					),
			);
			break;
		case "character":
			subquery = exists(
				client
					.select({ id: mediaCharacters.mediaId })
					.from(mediaCharacters)
					.innerJoin(characters, eq(mediaCharacters.characterId, characters.id))
					.where(
						and(
							eq(mediaCharacters.mediaId, medias.id),
							buildValueCondition(
								getRelationColumn(target, value),
								operator,
								value,
							),
						),
					),
			);
			break;
		case "author":
			subquery = exists(
				client
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

function buildRelationCondition(
	client: DrizzleExecutor,
	node: SearchCriterion,
): SQL | undefined {
	return buildRelationQuery(
		client,
		node.target as "tag" | "project" | "ip" | "character" | "author",
		node.operator,
		node.value as string | number | boolean,
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
	client: DrizzleExecutor,
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
		client
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
	client: DrizzleExecutor,
	operator: string,
	value: CriterionValue,
	negate?: boolean,
): SQL | undefined {
	const condition = exists(
		client
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

function buildCriterionQuery(
	client: DrizzleExecutor,
	node: SearchCriterion,
): SQL | undefined {
	if (node.target === "keyword") {
		return buildKeywordCondition(client, node);
	}
	if (["tag", "project", "ip", "character", "author"].includes(node.target)) {
		return buildRelationCondition(client, node);
	}
	if (node.target === "folder") {
		return buildFolderCondition(node);
	}
	if (["rating", "favorite", "viewCount"].includes(node.target)) {
		return buildDetailsQuery(
			client,
			node.target,
			node.operator,
			node.value,
			node.negate ?? false,
		);
	}
	if (node.target === "aiGenerated") {
		return buildGenerationInfoQuery(
			client,
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
	client: DrizzleExecutor,
	node: SearchGroup | SearchCriterion,
	depth = 0,
): SQL | undefined {
	const maxDepth = 10;
	if (depth > maxDepth) {
		throw new Error(`Search condition nesting too deep (max ${maxDepth})`);
	}

	if (node.type === "group") {
		const conditions = node.children
			.map((child) => buildSearchQuery(client, child, depth + 1))
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

	return buildCriterionQuery(client, node);
}

function getOrderByClause(sort: string | undefined, order: "asc" | "desc") {
	const direction = order === "asc" ? asc : desc;

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

export async function executeMediaSearch({
	client,
	params,
	mediaSourceId,
	mapMedia,
	defaultLimit = 100,
	defaultOffset = 0,
}: ExecuteMediaSearchOptions): Promise<MediaSearchResponse> {
	const conditions: SQL[] = [];
	if (mediaSourceId) {
		conditions.push(eq(medias.mediaSourceId, mediaSourceId));
	}
	if (params.condition) {
		const searchCondition = buildSearchQuery(client, params.condition);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
	const needsDetailsJoin = ["rating", "viewCount"].includes(params.sort ?? "");
	const orderBy = getOrderByClause(params.sort, params.order);
	const limit = params.limit ?? defaultLimit;
	const offset = params.offset ?? defaultOffset;

	const rows = needsDetailsJoin
		? await client
				.select({ media: medias })
				.from(medias)
				.leftJoin(mediaDetails, eq(mediaDetails.mediaId, medias.id))
				.where(whereClause)
				.limit(limit)
				.offset(offset)
				.orderBy(orderBy)
		: await client
				.select({ media: medias })
				.from(medias)
				.where(whereClause)
				.limit(limit)
				.offset(offset)
				.orderBy(orderBy);

	const countRows = await client
		.select({ count: sql<number>`count(*)` })
		.from(medias)
		.where(whereClause);

	return mediaSearchResponseSchema.parse({
		media: rows.map((row) => mapMedia(row.media)),
		total: Number(countRows[0]?.count ?? 0),
	});
}

export type SearchOptions = {
	query?: string;
	tags?: string[];
	tagMode?: "and" | "or";
	excludeTags?: string[];
	projects?: string[];
	ips?: string[];
	characters?: string[];
	sort?: "date" | "name" | "size";
	order?: "asc" | "desc";
	limit?: number;
	offset?: number;
};

function buildSearchRequestFromOptions(
	options: SearchOptions,
): MediaSearchRequest {
	const children: (SearchCriterion | SearchGroup)[] = [];

	if (options.query) {
		children.push({
			type: "criterion",
			target: "keyword",
			operator: "contains",
			value: options.query,
		});
	}

	if (options.tags && options.tags.length > 0) {
		if (options.tagMode === "and") {
			children.push({
				type: "group",
				operator: "and",
				children: options.tags.map((tag) => ({
					type: "criterion" as const,
					target: "tag" as const,
					operator: "equals" as const,
					value: tag,
				})),
			});
		} else {
			children.push({
				type: "criterion",
				target: "tag",
				operator: "in",
				value: options.tags,
			});
		}
	}

	if (options.excludeTags && options.excludeTags.length > 0) {
		children.push({
			type: "criterion" as const,
			target: "tag" as const,
			operator: "in" as const,
			value: options.excludeTags,
			negate: true,
		});
	}

	if (options.projects && options.projects.length > 0) {
		children.push({
			type: "criterion" as const,
			target: "project" as const,
			operator: "in" as const,
			value: options.projects,
		});
	}

	if (options.ips && options.ips.length > 0) {
		children.push({
			type: "criterion" as const,
			target: "ip" as const,
			operator: "in" as const,
			value: options.ips,
		});
	}

	if (options.characters && options.characters.length > 0) {
		children.push({
			type: "criterion" as const,
			target: "character" as const,
			operator: "in" as const,
			value: options.characters,
		});
	}

	return {
		condition:
			children.length > 0
				? { type: "group", operator: "and", children }
				: undefined,
		sort: options.sort,
		order: options.order,
		limit: options.limit,
		offset: options.offset,
	};
}

export const searchMedia = async (
	mediaSourceId: string,
	searchOptions: SearchOptions,
	client: DrizzleExecutor,
) => {
	return executeMediaSearch({
		client,
		mediaSourceId,
		params: buildSearchRequestFromOptions(searchOptions),
		mapMedia: (row) => row,
		defaultLimit: searchOptions.limit,
		defaultOffset: searchOptions.offset,
	});
};

export const globalSearchMedia = async (
	searchOptions: SearchOptions,
	client: DrizzleExecutor,
) => {
	return executeMediaSearch({
		client,
		params: buildSearchRequestFromOptions(searchOptions),
		mapMedia: (row) => row,
		defaultLimit: searchOptions.limit,
		defaultOffset: searchOptions.offset,
	});
};

export const searchMediaInDirectory = async (
	mediaSourceId: string,
	directoryPath: string,
	searchOptions: { query?: string; tags?: string[] },
	client: DrizzleExecutor,
) => {
	return executeMediaSearchInDirectory({
		client,
		mediaSourceId,
		directoryPath,
		params: searchOptions,
		mapMedia: (row) => row as Media,
	});
};

export async function executeMediaSearchInDirectory({
	client,
	mediaSourceId,
	directoryPath,
	params,
	mapMedia,
}: ExecuteMediaSearchInDirectoryOptions): Promise<Media[]> {
	try {
		const normalizedPath = directoryPath.replace(/[\\/]+$/, "");
		const prefixPattern = `${escapeLikePattern(normalizedPath)}/`;
		const conditions: (SQL | undefined)[] = [
			eq(medias.mediaSourceId, mediaSourceId),
			or(
				eq(medias.filePath, normalizedPath),
				like(medias.filePath, `${prefixPattern}%`),
			),
		];

		if (params.query) {
			const escapedQuery = escapeLikePattern(params.query);
			conditions.push(
				or(
					like(medias.fileName, `%${escapedQuery}%`),
					like(medias.description, `%${escapedQuery}%`),
				),
			);
		}

		if (params.tags && params.tags.length > 0) {
			const mediaIdsWithTags = client
				.select({ mediaId: mediaTags.mediaId })
				.from(mediaTags)
				.innerJoin(tags, eq(mediaTags.tagId, tags.id))
				.where(inArray(tags.name, params.tags));
			conditions.push(inArray(medias.id, mediaIdsWithTags));
		}

		const rows = await client
			.select()
			.from(medias)
			.where(and(...conditions));
		return rows.map((row) => mapMedia(row));
	} catch (error) {
		throw new UnexpectedError(
			`Failed to search media in directory ${directoryPath} for source ID: ${mediaSourceId}`,
			error,
		);
	}
}

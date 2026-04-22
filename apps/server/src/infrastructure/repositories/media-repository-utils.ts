import { UnexpectedError } from "@solid-imager/core/domain/errors";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	type InferSelectModel,
	inArray,
	like,
	notInArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import {
	mediaCharacters,
	mediaIps,
	mediaProjects,
	medias,
	mediaTags,
	tags,
} from "~/infrastructure/db/schema";

function escapeLikeString(str: string): string {
	return str.replace(/[%_]/g, "\\$&");
}

type SearchOptions = {
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

function buildWhereClause(
	mediaSourceId: string | undefined,
	options: SearchOptions,
	client: TransactionClient = db,
): SQL | undefined {
	const conditions: (SQL | undefined)[] = [];

	if (mediaSourceId) {
		conditions.push(eq(medias.mediaSourceId, mediaSourceId));
	}

	if (options.query) {
		const escapedQuery = escapeLikeString(options.query);
		conditions.push(
			or(
				like(medias.fileName, `%${escapedQuery}%`),
				like(medias.description, `%${escapedQuery}%`),
			),
		);
	}

	if (options.tags && options.tags.length > 0) {
		if (options.tagMode === "and") {
			const mediaIdsWithAllTags = client
				.select({ mediaId: mediaTags.mediaId })
				.from(mediaTags)
				.innerJoin(tags, eq(mediaTags.tagId, tags.id))
				.where(inArray(tags.name, options.tags))
				.groupBy(mediaTags.mediaId)
				.having(sql`COUNT(DISTINCT ${tags.name}) = ${options.tags.length}`);

			conditions.push(inArray(medias.id, mediaIdsWithAllTags));
		} else {
			const mediaIdsWithAnyTags = client
				.select({ mediaId: mediaTags.mediaId })
				.from(mediaTags)
				.innerJoin(tags, eq(mediaTags.tagId, tags.id))
				.where(inArray(tags.name, options.tags));

			conditions.push(inArray(medias.id, mediaIdsWithAnyTags));
		}
	}

	if (options.excludeTags && options.excludeTags.length > 0) {
		const excludedMediaIds = client
			.select({ mediaId: mediaTags.mediaId })
			.from(mediaTags)
			.innerJoin(tags, eq(mediaTags.tagId, tags.id))
			.where(inArray(tags.name, options.excludeTags));

		conditions.push(notInArray(medias.id, excludedMediaIds));
	}

	if (options.projects && options.projects.length > 0) {
		const projectMediaIds = client
			.select({ mediaId: mediaProjects.mediaId })
			.from(mediaProjects)
			.where(inArray(mediaProjects.projectId, options.projects));
		conditions.push(inArray(medias.id, projectMediaIds));
	}

	if (options.ips && options.ips.length > 0) {
		const ipMediaIds = client
			.select({ mediaId: mediaIps.mediaId })
			.from(mediaIps)
			.where(inArray(mediaIps.ipId, options.ips));
		conditions.push(inArray(medias.id, ipMediaIds));
	}

	if (options.characters && options.characters.length > 0) {
		const characterMediaIds = client
			.select({ mediaId: mediaCharacters.mediaId })
			.from(mediaCharacters)
			.where(inArray(mediaCharacters.characterId, options.characters));
		conditions.push(inArray(medias.id, characterMediaIds));
	}

	return and(...conditions);
}

function buildOrderByClause(
	sort?: "date" | "name" | "size",
	order: "asc" | "desc" = "desc",
): SQL[] {
	if (sort === "date") {
		return [
			order === "asc" ? asc(medias.createdAt) : desc(medias.createdAt),
			order === "asc" ? asc(medias.id) : desc(medias.id),
		];
	}
	if (sort === "name") {
		return [
			order === "asc" ? asc(medias.fileName) : desc(medias.fileName),
			order === "asc" ? asc(medias.id) : desc(medias.id),
		];
	}
	if (sort === "size") {
		return [
			order === "asc" ? asc(medias.fileSize) : desc(medias.fileSize),
			order === "asc" ? asc(medias.id) : desc(medias.id),
		];
	}
	return [desc(medias.createdAt), desc(medias.id)];
}

export const searchMedia = async (
	mediaSourceId: string,
	searchOptions: SearchOptions,
	client: TransactionClient = db,
) => {
	try {
		const whereClause = buildWhereClause(mediaSourceId, searchOptions, client);
		const orderByClause = buildOrderByClause(
			searchOptions.sort,
			searchOptions.order,
		);

		const query = client
			.select({
				...getTableColumns(medias),
				totalCount: sql<number>`count(*) over()`.mapWith(Number),
			})
			.from(medias)
			.where(whereClause)
			.orderBy(...orderByClause);

		let pagedQuery: any = query;

		if (searchOptions.limit !== undefined) {
			pagedQuery = pagedQuery
				.limit(searchOptions.limit)
				.offset(searchOptions.offset || 0);
		} else if (searchOptions.offset && searchOptions.offset > 0) {
			pagedQuery = pagedQuery.offset(searchOptions.offset);
		}

		const results = await pagedQuery;

		const mediaList = results.map(
			(r: InferSelectModel<typeof medias> & { totalCount: number }) => {
				const { totalCount, ...mediaData } = r;
				return mediaData;
			},
		);

		let total = results.length > 0 ? results[0].totalCount : 0;
		if (mediaList.length === 0 && (searchOptions.offset || 0) > 0) {
			const countResult = await client
				.select({ total: count() })
				.from(medias)
				.where(whereClause);
			total = countResult[0]?.total ?? 0;
		}

		return { media: mediaList, total };
	} catch (error) {
		throw new UnexpectedError(
			`Failed to search media for source ID: ${mediaSourceId}`,
			error,
		);
	}
};

export const searchMediaInDirectory = async (
	mediaSourceId: string,
	directoryPath: string,
	searchOptions: { query?: string; tags?: string[] },
	client: TransactionClient = db,
) => {
	try {
		const conditions: (SQL | undefined)[] = [
			eq(medias.mediaSourceId, mediaSourceId),
			like(medias.filePath, `${escapeLikeString(directoryPath)}%`),
		];

		if (searchOptions.query) {
			const escapedQuery = escapeLikeString(searchOptions.query);
			conditions.push(
				or(
					like(medias.fileName, `%${escapedQuery}%`),
					like(medias.description, `%${escapedQuery}%`),
				),
			);
		}

		if (searchOptions.tags && searchOptions.tags.length > 0) {
			const mediaIdsWithTags = client
				.select({ mediaId: mediaTags.mediaId })
				.from(mediaTags)
				.innerJoin(tags, eq(mediaTags.tagId, tags.id))
				.where(inArray(tags.name, searchOptions.tags));
			conditions.push(inArray(medias.id, mediaIdsWithTags));
		}

		return await client
			.select()
			.from(medias)
			.where(and(...conditions));
	} catch (error) {
		throw new UnexpectedError(
			`Failed to search media in directory ${directoryPath} for source ID: ${mediaSourceId}`,
			error,
		);
	}
};

export const globalSearchMedia = async (
	searchOptions: SearchOptions,
	client: TransactionClient = db,
) => {
	try {
		const whereClause = buildWhereClause(undefined, searchOptions, client);
		const orderByClause = buildOrderByClause(
			searchOptions.sort,
			searchOptions.order,
		);

		const [{ total }] = await client
			.select({ total: count() })
			.from(medias)
			.where(whereClause);

		const query = client
			.select()
			.from(medias)
			.where(whereClause)
			.orderBy(...orderByClause);

		let pagedQuery: any = query;

		if (searchOptions.limit !== undefined) {
			pagedQuery = pagedQuery
				.limit(searchOptions.limit)
				.offset(searchOptions.offset || 0);
		} else if (searchOptions.offset && searchOptions.offset > 0) {
			pagedQuery = pagedQuery.offset(searchOptions.offset);
		}

		const mediaList = await pagedQuery;

		return { media: mediaList, total };
	} catch (error) {
		throw new UnexpectedError("Failed to perform global media search", error);
	}
};

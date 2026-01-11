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
import { UnexpectedError } from "~/domain/errors";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import {
  mediaCharacters,
  mediaIps,
  mediaProjects,
  medias,
  mediaTags,
  tags,
} from "~/infrastructure/db/schema";

/**
 * Escapes special characters ...
 */
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

/**
 * Builds the WHERE clause for media search.
 */
function buildWhereClause(
  mediaSourceId: string | undefined,
  options: SearchOptions,
  client: TransactionClient = db
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];

  if (mediaSourceId) {
    conditions.push(eq(medias.mediaSourceId, mediaSourceId));
  }

  // Filename/description search with escape
  if (options.query) {
    const escapedQuery = escapeLikeString(options.query);
    conditions.push(
      or(
        like(medias.fileName, `%${escapedQuery}%`),
        like(medias.description, `%${escapedQuery}%`)
      )
    );
  }

  // Include tags filter
  if (options.tags && options.tags.length > 0) {
    if (options.tagMode === "and") {
      // AND mode: media must have ALL specified tags
      const mediaIdsWithAllTags = client
        .select({ mediaId: mediaTags.mediaId })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(inArray(tags.name, options.tags))
        .groupBy(mediaTags.mediaId)
        .having(sql`COUNT(DISTINCT ${tags.name}) = ${options.tags.length}`);

      conditions.push(inArray(medias.id, mediaIdsWithAllTags));
    } else {
      // OR mode: media must have ANY of the specified tags
      const mediaIdsWithAnyTags = client
        .select({ mediaId: mediaTags.mediaId })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(inArray(tags.name, options.tags));

      conditions.push(inArray(medias.id, mediaIdsWithAnyTags));
    }
  }

  // Exclude tags filter
  if (options.excludeTags && options.excludeTags.length > 0) {
    const excludedMediaIds = client
      .select({ mediaId: mediaTags.mediaId })
      .from(mediaTags)
      .innerJoin(tags, eq(mediaTags.tagId, tags.id))
      .where(inArray(tags.name, options.excludeTags));

    conditions.push(notInArray(medias.id, excludedMediaIds));
  }

  // Project filter
  if (options.projects && options.projects.length > 0) {
    const projectMediaIds = client
      .select({ mediaId: mediaProjects.mediaId })
      .from(mediaProjects)
      .where(inArray(mediaProjects.projectId, options.projects));
    conditions.push(inArray(medias.id, projectMediaIds));
  }

  // IP filter
  if (options.ips && options.ips.length > 0) {
    const ipMediaIds = client
      .select({ mediaId: mediaIps.mediaId })
      .from(mediaIps)
      .where(inArray(mediaIps.ipId, options.ips));
    conditions.push(inArray(medias.id, ipMediaIds));
  }

  // Character filter
  if (options.characters && options.characters.length > 0) {
    const characterMediaIds = client
      .select({ mediaId: mediaCharacters.mediaId })
      .from(mediaCharacters)
      .where(inArray(mediaCharacters.characterId, options.characters));
    conditions.push(inArray(medias.id, characterMediaIds));
  }

  return and(...conditions);
}

/**
 * Builds the ORDER BY clause for media search.
 */
function buildOrderByClause(
  sort?: "date" | "name" | "size",
  order: "asc" | "desc" = "desc"
): SQL {
  if (sort === "date") {
    return order === "asc" ? asc(medias.createdAt) : desc(medias.createdAt);
  }
  if (sort === "name") {
    return order === "asc" ? asc(medias.fileName) : desc(medias.fileName);
  }
  if (sort === "size") {
    return order === "asc" ? asc(medias.fileSize) : desc(medias.fileSize);
  }
  // Default sort
  return desc(medias.createdAt);
}

/**
 * Searches for media within a specific source based on a query and/or tags.
 * Uses SQL-based pagination and filtering for performance.
 *
 * @param {string} mediaSourceId - The ID of the media source to search within.
 * @param {object} searchOptions - Options for the search.
 * @returns {Promise<{ media: InferSelectModel<typeof medias>[]; total: number }>} A promise that resolves with matching media items and total count.
 * @throws {UnexpectedError} If a database error occurs during the search.
 */
export const searchMedia = async (
  mediaSourceId: string,
  searchOptions: SearchOptions,
  client: TransactionClient = db
) => {
  try {
    const whereClause = buildWhereClause(mediaSourceId, searchOptions, client);
    const orderByClause = buildOrderByClause(
      searchOptions.sort,
      searchOptions.order
    );

    // Optimize: Combine count and data retrieval into a single query using window functions
    const query = client
      .select({
        ...getTableColumns(medias),
        totalCount: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(medias)
      .where(whereClause)
      .orderBy(orderByClause);

    // Apply pagination if limit is provided
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder type mismatch
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
        // Extract original media columns by removing totalCount
        // biome-ignore lint/correctness/noUnusedVariables: Used to separate totalCount from rest
        const { totalCount, ...mediaData } = r;
        return mediaData;
      }
    );

    let total = results.length > 0 ? results[0].totalCount : 0;

    // Fallback: If result is empty but offset > 0, we don't know the total.
    // We must run a count query to get the total.
    // If offset is 0 and result is empty, total is definitely 0.
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
      error
    );
  }
};

/**
 * Searches for media within a specific directory of a given source based on a query and/or tags.
 * @param {string} mediaSourceId - The ID of the media source to search within.
 * @param {string} directoryPath - The path to the directory to search.
 * @param {object} searchOptions - Options for the search.
 * @param {string} [searchOptions.query] - A search query string to match against filenames and descriptions.
 * @param {string[]} [searchOptions.tags] - An array of tag names to filter media by.
 * @returns {Promise<InferSelectModel<typeof medias>[]>} A promise that resolves with an array of matching media items within the directory.
 * @throws {UnexpectedError} If a database error occurs during the search.
 */
export const searchMediaInDirectory = async (
  mediaSourceId: string,
  directoryPath: string,
  searchOptions: { query?: string; tags?: string[] },
  client: TransactionClient = db
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
          like(medias.description, `%${escapedQuery}%`)
        )
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
      error
    );
  }
};

/**
 * Performs a global search for media across all sources based on search options.
 * @param {SearchOptions} searchOptions - Options for the search.
 * @param {TransactionClient} client - The database client to use.
 * @returns {Promise<{ media: InferSelectModel<typeof medias>[]; total: number }>} A promise that resolves with matching media items from all sources.
 * @throws {UnexpectedError} If a database error occurs during the search.
 */
export const globalSearchMedia = async (
  searchOptions: SearchOptions,
  client: TransactionClient = db
) => {
  try {
    const whereClause = buildWhereClause(undefined, searchOptions, client);
    const orderByClause = buildOrderByClause(
      searchOptions.sort,
      searchOptions.order
    );

    // Execute Count Query
    const [{ total }] = await client
      .select({ total: count() })
      .from(medias)
      .where(whereClause);

    // Execute Main Query
    const query = client
      .select()
      .from(medias)
      .where(whereClause)
      .orderBy(orderByClause);

    // Apply pagination if limit is provided
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle query builder type mismatch
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

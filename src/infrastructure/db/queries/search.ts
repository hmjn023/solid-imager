import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import {
  type Media,
  mediaCharacters,
  mediaIps,
  mediaProjects,
  medias,
  mediaTags,
  tags,
} from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

/**
 * Escapes special characters in a string for use in a LIKE query.
 * Escapes % and _.
 */
function escapeLikeString(str: string): string {
  return str.replace(/[%_]/g, "\\$&");
}

type SearchOptions = {
  query?: string;
  tags?: string[];
  tagMode?: "and" | "or";
  excludeTags?: string[];
  projects?: number[];
  ips?: number[];
  characters?: number[];
  sort?: "date" | "name" | "size";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

/**
 * Builds the WHERE clause for media search.
 */
function buildWhereClause(
  mediaSourceId: string,
  options: SearchOptions
): SQL | undefined {
  const conditions: SQL[] = [eq(medias.mediaSourceId, mediaSourceId)];

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
      const mediaIdsWithAllTags = db
        .select({ mediaId: mediaTags.mediaId })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(inArray(tags.name, options.tags))
        .groupBy(mediaTags.mediaId)
        .having(sql`COUNT(DISTINCT ${tags.name}) = ${options.tags.length}`);

      conditions.push(inArray(medias.id, mediaIdsWithAllTags));
    } else {
      // OR mode: media must have ANY of the specified tags
      const mediaIdsWithAnyTags = db
        .select({ mediaId: mediaTags.mediaId })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(inArray(tags.name, options.tags));

      conditions.push(inArray(medias.id, mediaIdsWithAnyTags));
    }
  }

  // Exclude tags filter
  if (options.excludeTags && options.excludeTags.length > 0) {
    const excludedMediaIds = db
      .select({ mediaId: mediaTags.mediaId })
      .from(mediaTags)
      .innerJoin(tags, eq(mediaTags.tagId, tags.id))
      .where(inArray(tags.name, options.excludeTags));

    conditions.push(notInArray(medias.id, excludedMediaIds));
  }

  // Project filter
  if (options.projects && options.projects.length > 0) {
    const projectMediaIds = db
      .select({ mediaId: mediaProjects.mediaId })
      .from(mediaProjects)
      .where(inArray(mediaProjects.projectId, options.projects));
    conditions.push(inArray(medias.id, projectMediaIds));
  }

  // IP filter
  if (options.ips && options.ips.length > 0) {
    const ipMediaIds = db
      .select({ mediaId: mediaIps.mediaId })
      .from(mediaIps)
      .where(inArray(mediaIps.ipId, options.ips));
    conditions.push(inArray(medias.id, ipMediaIds));
  }

  // Character filter
  if (options.characters && options.characters.length > 0) {
    const characterMediaIds = db
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
 * @returns {Promise<{ media: Media[]; total: number }>} A promise that resolves with matching media items and total count.
 * @throws {UnknownDbError} If a database error occurs during the search.
 */
export const searchMedia = async (
  mediaSourceId: string,
  searchOptions: SearchOptions
) => {
  try {
    const whereClause = buildWhereClause(mediaSourceId, searchOptions);
    const orderByClause = buildOrderByClause(
      searchOptions.sort,
      searchOptions.order
    );

    // Execute Count Query
    const [{ total }] = await db
      .select({ total: count() })
      .from(medias)
      .where(whereClause);

    // Execute Main Query
    let query = db
      .select()
      .from(medias)
      .where(whereClause)
      .orderBy(orderByClause);

    // Apply pagination if limit is provided
    if (searchOptions.limit !== undefined) {
      query = query
        .limit(searchOptions.limit)
        .offset(searchOptions.offset || 0);
    } else if (searchOptions.offset && searchOptions.offset > 0) {
      query = query.offset(searchOptions.offset);
    }

    const mediaList = await query;

    return { media: mediaList, total };
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to search media for source ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

/**
 * Searches for media within a specific directory of a given source based on a query and/or tags.
 * @param {string} mediaSourceId - The ID of the media source to search within.
 * @param {string} directoryPath - The path to the directory to search.
 * @param {object} searchOptions - Options for the search.
 * @param {string} [searchOptions.query] - A search query string to match against filenames and descriptions.
 * @param {string[]} [searchOptions.tags] - An array of tag names to filter media by.
 * @returns {Promise<Media[]>} A promise that resolves with an array of matching media items within the directory.
 * @throws {UnknownDbError} If a database error occurs during the search.
 */
export const searchMediaInDirectory = async (
  mediaSourceId: string,
  directoryPath: string,
  searchOptions: { query?: string; tags?: string[] }
) => {
  try {
    const conditions: SQL[] = [
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
      const mediaIdsWithTags = db
        .select({ mediaId: mediaTags.mediaId })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(inArray(tags.name, searchOptions.tags));
      conditions.push(inArray(medias.id, mediaIdsWithTags));
    }

    return await db
      .select()
      .from(medias)
      .where(and(...conditions));
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to search media in directory ${directoryPath} for source ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

/**
 * Performs a global search for media across all sources based on a query and/or tags.
 * @param {object} searchOptions - Options for the search.
 * @param {string} [searchOptions.query] - A search query string to match against filenames and descriptions.
 * @param {string[]} [searchOptions.tags] - An array of tag names to filter media by.
 * @returns {Promise<Media[]>} A promise that resolves with an array of matching media items from all sources.
 * @throws {UnknownDbError} If a database error occurs during the search.
 */
export const globalSearchMedia = async (searchOptions: {
  query?: string;
  tags?: string[];
}) => {
  try {
    const conditions: SQL[] = [];

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
      const mediaIdsWithTags = db
        .select({ mediaId: mediaTags.mediaId })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(inArray(tags.name, searchOptions.tags));
      conditions.push(inArray(medias.id, mediaIdsWithTags));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await db.select().from(medias).where(whereClause);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to perform global media search",
      details: error,
    });
  }
};

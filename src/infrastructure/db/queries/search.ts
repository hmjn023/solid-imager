import { and, eq, inArray, like, or, sql } from "drizzle-orm";
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
 * Helper function to sort media items
 */
function sortMediaItems(
  items: Media[],
  sortField?: "date" | "name" | "size",
  sortOrder: "asc" | "desc" = "desc"
): Media[] {
  if (!sortField) {
    return items;
  }

  return items.sort((a, b) => {
    let comparison = 0;
    if (sortField === "date") {
      comparison = a.createdAt.getTime() - b.createdAt.getTime();
    } else if (sortField === "name") {
      comparison = a.fileName.localeCompare(b.fileName);
    } else if (sortField === "size") {
      comparison = (a.fileSize || 0) - (b.fileSize || 0);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });
}

/**
 * Searches for media within a specific source based on a query and/or tags.
 * @param {string} mediaSourceId - The ID of the media source to search within.
 * @param {object} searchOptions - Options for the search.
 * @param {string} [searchOptions.query] - A search query string to match against filenames and descriptions.
 * @param {string[]} [searchOptions.tags] - An array of tag names to filter media by.
 * @param {string} [searchOptions.tagMode] - Tag matching mode: "and" (all tags) or "or" (any tag). Default: "and".
 * @param {string[]} [searchOptions.excludeTags] - An array of tag names to exclude from results.
 * @param {number[]} [searchOptions.projects] - An array of project IDs to filter by.
 * @param {number[]} [searchOptions.ips] - An array of IP IDs to filter by.
 * @param {number[]} [searchOptions.characters] - An array of character IDs to filter by.
 * @param {string} [searchOptions.sort] - Sort field: "date", "name", or "size".
 * @param {string} [searchOptions.order] - Sort order: "asc" or "desc". Default: "desc".
 * @param {number} [searchOptions.limit] - Maximum number of results to return.
 * @param {number} [searchOptions.offset] - Number of results to skip for pagination. Default: 0.
 * @returns {Promise<{ media: Media[]; total: number }>} A promise that resolves with matching media items and total count.
 * @throws {UnknownDbError} If a database error occurs during the search.
 */
export const searchMedia = async (
  mediaSourceId: string,
  searchOptions: {
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
  }
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Search function requires multiple filter conditions
) => {
  try {
    const {
      query: searchQuery,
      tags: includeTags,
      tagMode = "and",
      excludeTags,
      projects,
      ips,
      characters,
      sort,
      order = "desc",
      limit,
      offset = 0,
    } = searchOptions;

    let queryBuilder = db
      .select()
      .from(medias)
      .where(eq(medias.mediaSourceId, mediaSourceId));

    // Filename/description search
    if (searchQuery) {
      queryBuilder = queryBuilder.where(
        or(
          like(medias.fileName, `%${searchQuery}%`),
          like(medias.description, `%${searchQuery}%`)
        )
      );
    }

    // Include tags filter
    if (includeTags && includeTags.length > 0) {
      if (tagMode === "and") {
        // AND mode: media must have ALL specified tags
        // Use a subquery with GROUP BY and HAVING to ensure all tags are present
        const mediaIdsWithAllTags = db
          .select({ mediaId: mediaTags.mediaId })
          .from(mediaTags)
          .innerJoin(tags, eq(mediaTags.tagId, tags.id))
          .where(inArray(tags.name, includeTags))
          .groupBy(mediaTags.mediaId)
          .having(sql`COUNT(DISTINCT ${tags.name}) = ${includeTags.length}`);

        queryBuilder = queryBuilder.where(
          inArray(medias.id, mediaIdsWithAllTags)
        );
      } else {
        // OR mode: media must have ANY of the specified tags
        queryBuilder = queryBuilder.where(
          inArray(
            medias.id,
            db
              .select({ mediaId: mediaTags.mediaId })
              .from(mediaTags)
              .innerJoin(tags, eq(mediaTags.tagId, tags.id))
              .where(inArray(tags.name, includeTags))
          )
        );
      }
    }

    // Project filter
    if (projects && projects.length > 0) {
      queryBuilder = queryBuilder.where(
        inArray(
          medias.id,
          db
            .select({ mediaId: mediaProjects.mediaId })
            .from(mediaProjects)
            .where(inArray(mediaProjects.projectId, projects))
        )
      );
    }

    // IP filter
    if (ips && ips.length > 0) {
      queryBuilder = queryBuilder.where(
        inArray(
          medias.id,
          db
            .select({ mediaId: mediaIps.mediaId })
            .from(mediaIps)
            .where(inArray(mediaIps.ipId, ips))
        )
      );
    }

    // Character filter
    if (characters && characters.length > 0) {
      queryBuilder = queryBuilder.where(
        inArray(
          medias.id,
          db
            .select({ mediaId: mediaCharacters.mediaId })
            .from(mediaCharacters)
            .where(inArray(mediaCharacters.characterId, characters))
        )
      );
    }

    // Exclude tags filter
    if (excludeTags && excludeTags.length > 0) {
      const excludedMediaIds = db
        .select({ mediaId: mediaTags.mediaId })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(inArray(tags.name, excludeTags));

      // Filter out media that have any of the excluded tags
      const allMedia = await queryBuilder;
      const excludedIds = await excludedMediaIds;
      const excludedIdSet = new Set(
        excludedIds.map((e: { mediaId: string }) => e.mediaId)
      );
      const filteredMedia = allMedia.filter(
        (m: { id: string }) => !excludedIdSet.has(m.id)
      );

      // Get total count before pagination
      const total = filteredMedia.length;

      // Apply sorting
      const sortedMedia = sortMediaItems(filteredMedia, sort, order);

      // Apply pagination
      const paginatedMedia =
        limit !== undefined
          ? sortedMedia.slice(offset, offset + limit)
          : sortedMedia.slice(offset);

      return { media: paginatedMedia, total };
    }

    // No exclude tags - use database sorting and pagination
    const allMedia = await queryBuilder;
    const total = allMedia.length;

    // Apply sorting
    const sortedMedia = sortMediaItems(allMedia, sort, order);

    // Apply pagination
    const paginatedMedia =
      limit !== undefined
        ? sortedMedia.slice(offset, offset + limit)
        : sortedMedia.slice(offset);

    return { media: paginatedMedia, total };
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
    let query = db
      .select()
      .from(medias)
      .where(
        and(
          eq(medias.mediaSourceId, mediaSourceId),
          like(medias.filePath, `${directoryPath}%`)
        )
      );

    if (searchOptions.query) {
      query = query.where(
        or(
          like(medias.fileName, `%${searchOptions.query}%`),
          like(medias.description, `%${searchOptions.query}%`)
        )
      );
    }

    if (searchOptions.tags && searchOptions.tags.length > 0) {
      query = query.where(
        inArray(
          medias.id,
          db
            .select({ mediaId: mediaTags.mediaId })
            .from(mediaTags)
            .innerJoin(tags, eq(mediaTags.tagId, tags.id))
            .where(inArray(tags.name, searchOptions.tags))
        )
      );
    }

    return await query;
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
    let query = db.select().from(medias);

    if (searchOptions.query) {
      query = query.where(
        or(
          like(medias.fileName, `%${searchOptions.query}%`),
          like(medias.description, `%${searchOptions.query}%`)
        )
      );
    }

    if (searchOptions.tags && searchOptions.tags.length > 0) {
      query = query.where(
        inArray(
          medias.id,
          db
            .select({ mediaId: mediaTags.mediaId })
            .from(mediaTags)
            .innerJoin(tags, eq(mediaTags.tagId, tags.id))
            .where(inArray(tags.name, searchOptions.tags))
        )
      );
    }

    return await query;
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to perform global media search",
      details: error,
    });
  }
};

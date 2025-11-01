import { and, eq, inArray, like, or } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { medias, mediaTags, tags } from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

/**
 * Searches for media within a specific source based on a query and/or tags.
 * @param {string} sourceId - The ID of the media source to search within.
 * @param {object} searchOptions - Options for the search.
 * @param {string} [searchOptions.query] - A search query string to match against filenames and descriptions.
 * @param {string[]} [searchOptions.tags] - An array of tag names to filter media by.
 * @returns {Promise<Media[]>} A promise that resolves with an array of matching media items.
 * @throws {UnknownDbError} If a database error occurs during the search.
 */
export const searchMedia = async (
  sourceId: string,
  searchOptions: { query?: string; tags?: string[] }
) => {
  try {
    let query = db.select().from(medias).where(eq(medias.sourceId, sourceId));

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
      message: `Failed to search media for source ID: ${sourceId}`,
      details: error,
    });
  }
};

/**
 * Searches for media within a specific directory of a given source based on a query and/or tags.
 * @param {string} sourceId - The ID of the media source to search within.
 * @param {string} directoryPath - The path to the directory to search.
 * @param {object} searchOptions - Options for the search.
 * @param {string} [searchOptions.query] - A search query string to match against filenames and descriptions.
 * @param {string[]} [searchOptions.tags] - An array of tag names to filter media by.
 * @returns {Promise<Media[]>} A promise that resolves with an array of matching media items within the directory.
 * @throws {UnknownDbError} If a database error occurs during the search.
 */
export const searchMediaInDirectory = async (
  sourceId: string,
  directoryPath: string,
  searchOptions: { query?: string; tags?: string[] }
) => {
  try {
    let query = db
      .select()
      .from(medias)
      .where(
        and(
          eq(medias.sourceId, sourceId),
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
      message: `Failed to search media in directory ${directoryPath} for source ID: ${sourceId}`,
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

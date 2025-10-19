import { and, eq, inArray, like, or } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { medias, mediaTags, tags } from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

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

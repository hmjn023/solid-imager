import { and, eq, inArray } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import {
  type Media,
  medias,
  mediaTags,
  type NewMediaTag,
} from "~/infrastructure/db/schema";
import { ConstraintError, UnknownDbError } from "../errors";

export const bulkUpdateMedia = async (
  sourceId: string,
  mediaIds: string[],
  updates: Partial<Media>
) => {
  try {
    return await db
      .update(medias)
      .set(updates)
      .where(and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds)))
      .returning();
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to bulk update media for source ID: ${sourceId}`,
      details: error,
    });
  }
};

export const bulkDeleteMedia = async (sourceId: string, mediaIds: string[]) => {
  try {
    return await db
      .delete(medias)
      .where(and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds)))
      .returning();
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to bulk delete media for source ID: ${sourceId}`,
      details: error,
    });
  }
};

export const bulkUpdateMediaPaths = async (
  sourceId: string,
  mediaIds: string[],
  pathUpdates: string
) => {
  try {
    return await db.transaction(async (tx) => {
      const mediaToUpdate = await tx
        .select({ id: medias.id, fileName: medias.fileName })
        .from(medias)
        .where(
          and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
        );

      const updates = mediaToUpdate.map((media) => {
        const newFilePath = `${pathUpdates}/${media.fileName}`;
        return tx
          .update(medias)
          .set({ filePath: newFilePath })
          .where(eq(medias.id, media.id));
      });

      return Promise.all(updates);
    });
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to bulk update media paths for source ID: ${sourceId}`,
      details: error,
    });
  }
};

export const bulkAddMediaTags = async (
  _sourceId: string,
  mediaIds: string[],
  tagsToAdd: number[]
) => {
  const values: NewMediaTag[] = [];
  for (const mediaId of mediaIds) {
    for (const tagId of tagsToAdd) {
      values.push({ mediaId, tagId });
    }
  }

  if (values.length === 0) {
    return [];
  }

  try {
    return await db.insert(mediaTags).values(values).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "One or more media tags already exist",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to bulk add media tags",
      details: error,
    });
  }
};

export const bulkRemoveMediaTags = async (
  _sourceId: string,
  mediaIds: string[],
  tagsToRemove: number[]
) => {
  if (mediaIds.length === 0 || tagsToRemove.length === 0) {
    return [];
  }

  try {
    return await db
      .delete(mediaTags)
      .where(
        and(
          inArray(mediaTags.mediaId, mediaIds),
          inArray(mediaTags.tagId, tagsToRemove)
        )
      )
      .returning();
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to bulk remove media tags",
      details: error,
    });
  }
};

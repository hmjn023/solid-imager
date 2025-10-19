import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import {
  type MediaSource,
  mediaSources,
  type NewMediaSource,
} from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

export const selectMediaSources = async (): Promise<MediaSource[]> => {
  try {
    return await db.select().from(mediaSources);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select media sources",
      details: error,
    });
  }
};

export const selectMediaSourceById = async (
  mediaSourceId: string
): Promise<MediaSource> => {
  try {
    const result = await db
      .select()
      .from(mediaSources)
      .where(eq(mediaSources.id, mediaSourceId));
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media source with ID ${mediaSourceId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select media source by ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

export const insertMediaSource = async (
  mediaSource: NewMediaSource
): Promise<MediaSource[]> => {
  try {
    return await db.insert(mediaSources).values(mediaSource).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Media source with this name or ID already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to insert media source",
      details: error,
    });
  }
};

export const updateMediaSource = async (
  mediaSourceId: string,
  mediaSource: MediaSource
): Promise<MediaSource> => {
  try {
    const result = await db
      .update(mediaSources)
      .set(mediaSource)
      .where(eq(mediaSources.id, mediaSourceId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media source with ID ${mediaSourceId} not found`,
      });
    }
    return result[0];
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Media source with this name or ID already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to update media source",
      details: error,
    });
  }
};

export const deleteMediaSource = async (
  mediaSourceId: string
): Promise<MediaSource> => {
  try {
    const result = await db
      .delete(mediaSources)
      .where(eq(mediaSources.id, mediaSourceId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media source with ID ${mediaSourceId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete media source with ID: ${mediaSourceId}`,
      details: error,
    });
  }
};

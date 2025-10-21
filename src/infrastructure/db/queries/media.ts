import { and, eq, like } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { type Media, medias } from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "../errors";

export const insertMedia = async (
  newMedia: Omit<Media, "id" | "createdAt" | "modifiedAt" | "indexedAt">
): Promise<Media> => {
  try {
    const result = await db.insert(medias).values(newMedia).returning();
    return result[0];
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to insert media",
      details: error,
    });
  }
};

export const selectMediaBySourceIdAndFilePath = async (
  sourceId: string,
  filePath: string
): Promise<Media[]> => {
  try {
    const result = await db
      .select({
        id: medias.id,
        sourceId: medias.sourceId,
        filePath: medias.filePath,
        fileName: medias.fileName,
        mediaType: medias.mediaType,
        width: medias.width,
        height: medias.height,
        fileSize: medias.fileSize,
        description: medias.description,
        sourceUrl: medias.sourceUrl,
        createdAt: medias.createdAt,
        modifiedAt: medias.modifiedAt,
        indexedAt: medias.indexedAt,
        status: medias.status,
      })
      .from(medias)
      .where(and(eq(medias.sourceId, sourceId), eq(medias.filePath, filePath)));
    return result;
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select media by source ID and file path",
      details: error,
    });
  }
};

export const selectMediaById = async (id: string): Promise<Media> => {
  try {
    const result = await db.select().from(medias).where(eq(medias.id, id));
    if (result.length === 0) {
      throw new NotFoundError({ message: `Media with ID ${id} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select media by ID: ${id}`,
      details: error,
    });
  }
};

export const selectMediaBySourceIdAndDirectoryPath = async (
  sourceId: string,
  directoryPath: string
): Promise<Media[]> => {
  try {
    const searchPath = `${directoryPath}%`;
    const result = await db
      .select()
      .from(medias)
      .where(
        and(eq(medias.sourceId, sourceId), like(medias.filePath, searchPath))
      );
    return result;
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select media by source ID and directory path",
      details: error,
    });
  }
};

export const updateMedia = async (
  id: string,
  updatedMedia: Partial<Media>
): Promise<Media> => {
  try {
    const result = await db
      .update(medias)
      .set(updatedMedia)
      .where(eq(medias.id, id))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `Media with ID ${id} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to update media with ID: ${id}`,
      details: error,
    });
  }
};

export const deleteMedia = async (id: string): Promise<Media> => {
  try {
    const result = await db.delete(medias).where(eq(medias.id, id)).returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `Media with ID ${id} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete media with ID: ${id}`,
      details: error,
    });
  }
};

export const selectMediaBySourceId = async (
  sourceId: string
): Promise<Media[]> => {
  try {
    return await db.select().from(medias).where(eq(medias.sourceId, sourceId));
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to select medias by source ID: ${sourceId}`,
      details: error,
    });
  }
};

export const deleteMediaByPath = async (
  sourceId: string,
  directoryPath: string
): Promise<Media[]> => {
  try {
    return await db
      .delete(medias)
      .where(
        and(
          eq(medias.sourceId, sourceId),
          like(medias.filePath, `${directoryPath}%`)
        )
      )
      .returning();
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to delete medias by path ${directoryPath} for source ID: ${sourceId}`,
      details: error,
    });
  }
};

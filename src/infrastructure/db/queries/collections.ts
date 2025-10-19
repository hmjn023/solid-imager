import { and, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { collectionMedia, collections } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

export const selectCollections = async () => {
  try {
    return await db.select().from(collections);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select collections",
      details: error,
    });
  }
};

export const insertCollection = async (collectionData: unknown) => {
  try {
    return await db.insert(collections).values(collectionData).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Collection with this name already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to insert collection",
      details: error,
    });
  }
};

export const selectCollectionById = async (collectionId: string) => {
  try {
    const result = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId));
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Collection with ID ${collectionId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select collection by ID: ${collectionId}`,
      details: error,
    });
  }
};

export const updateCollection = async (
  collectionId: string,
  collectionData: unknown
) => {
  try {
    const result = await db
      .update(collections)
      .set(collectionData)
      .where(eq(collections.id, collectionId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Collection with ID ${collectionId} not found`,
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
        message: "Collection with this name already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: `Failed to update collection with ID: ${collectionId}`,
      details: error,
    });
  }
};

export const deleteCollection = async (collectionId: string) => {
  try {
    const result = await db
      .delete(collections)
      .where(eq(collections.id, collectionId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Collection with ID ${collectionId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete collection with ID: ${collectionId}`,
      details: error,
    });
  }
};

export const insertCollectionMedia = async (
  collectionId: string,
  mediaId: string,
  displayOrder?: number
) => {
  try {
    return await db
      .insert(collectionMedia)
      .values({ collectionId, mediaId, displayOrder })
      .returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Media already exists in this collection",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: `Failed to insert media ${mediaId} into collection ${collectionId}`,
      details: error,
    });
  }
};

export const deleteCollectionMedia = async (
  collectionId: string,
  mediaId: string
) => {
  try {
    const result = await db
      .delete(collectionMedia)
      .where(
        and(
          eq(collectionMedia.collectionId, collectionId),
          eq(collectionMedia.mediaId, mediaId)
        )
      )
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media ${mediaId} not found in collection ${collectionId}`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete media ${mediaId} from collection ${collectionId}`,
      details: error,
    });
  }
};

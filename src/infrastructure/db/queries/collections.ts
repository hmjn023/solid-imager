import { and, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { collections, mediaCollections } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

/**
 * Selects all collections from the database.
 * @returns {Promise<Collection[]>} A promise that resolves with an array of collection objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
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

/**
 * Inserts a new collection into the database.
 * @param {unknown} collectionData - The data for the new collection.
 * @returns {Promise<Collection[]>} A promise that resolves with an array containing the newly inserted collection.
 * @throws {ConstraintError} If a collection with the same name already exists.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
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

/**
 * Selects a collection by its ID from the database.
 * @param {string} collectionId - The ID of the collection to select.
 * @returns {Promise<Collection>} A promise that resolves with the collection object.
 * @throws {NotFoundError} If no collection with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
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

/**
 * Updates an existing collection in the database.
 * @param {string} collectionId - The ID of the collection to update.
 * @param {unknown} collectionData - The partial data to update the collection with.
 * @returns {Promise<Collection>} A promise that resolves with the updated collection object.
 * @throws {NotFoundError} If no collection with the given ID is found.
 * @throws {ConstraintError} If the update causes a unique constraint violation (e.g., duplicate name).
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
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

/**
 * Deletes a collection from the database.
 * @param {string} collectionId - The ID of the collection to delete.
 * @returns {Promise<Collection>} A promise that resolves with the deleted collection object.
 * @throws {NotFoundError} If no collection with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
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

/**
 * Inserts a media item into a collection.
 * @param {string} collectionId - The ID of the collection.
 * @param {string} mediaId - The ID of the media item to insert.
 * @param {number} [displayOrder] - The display order of the media item within the collection.
 * @returns {Promise<MediaCollection[]>} A promise that resolves with an array containing the newly inserted media collection relationship.
 * @throws {ConstraintError} If the media item already exists in the collection.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
export const insertCollectionMedia = async (
  collectionId: string,
  mediaId: string,
  displayOrder?: number
) => {
  try {
    return await db
      .insert(mediaCollections)
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

/**
 * Deletes a media item from a collection.
 * @param {string} collectionId - The ID of the collection.
 * @param {string} mediaId - The ID of the media item to delete from the collection.
 * @returns {Promise<MediaCollection[]>} A promise that resolves with an array containing the deleted media collection relationship.
 * @throws {NotFoundError} If the media item is not found in the specified collection.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const deleteCollectionMedia = async (
  collectionId: string,
  mediaId: string
) => {
  try {
    const result = await db
      .delete(mediaCollections)
      .where(
        and(
          eq(mediaCollections.collectionId, collectionId),
          eq(mediaCollections.mediaId, mediaId)
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

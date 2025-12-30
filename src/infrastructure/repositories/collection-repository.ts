import { and, eq } from "drizzle-orm";
import type {
  Collection,
  NewCollection,
  NewCollectionItem,
  UpdateCollection,
} from "~/domain/collections/schemas";
import type { ICollectionRepository } from "~/domain/repositories/collection.repository";
import { ConstraintError, NotFoundError } from "~/infrastructure/db/errors";
import { db } from "~/infrastructure/db/index";
import { collections, mediaCollections } from "~/infrastructure/db/schema";

export const CollectionRepository: ICollectionRepository = {
  async findAll(): Promise<Collection[]> {
    return await db.select().from(collections);
  },

  async findById(id: string): Promise<Collection | null> {
    const result = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);
    return result[0] || null;
  },

  async create(collection: NewCollection): Promise<Collection> {
    try {
      const result = await db
        .insert(collections)
        .values(collection)
        .returning();
      return result[0];
    } catch (error: unknown) {
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "23505") {
        // Unique violation
        throw new ConstraintError({
          message: "Collection with this name already exists",
          details: error,
        });
      }
      throw error;
    }
  },

  async update(id: string, updates: UpdateCollection): Promise<Collection> {
    try {
      const result = await db
        .update(collections)
        .set(updates)
        .where(eq(collections.id, id))
        .returning();

      if (!result[0]) {
        throw new NotFoundError({
          message: `Collection with ID ${id} not found`,
        });
      }
      return result[0];
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "23505") {
        throw new ConstraintError({
          message: "Collection with this name already exists",
          details: error,
        });
      }
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    const result = await db
      .delete(collections)
      .where(eq(collections.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundError({
        message: `Collection with ID ${id} not found`,
      });
    }
  },

  async addItem(collectionId: string, item: NewCollectionItem): Promise<void> {
    try {
      await db.insert(mediaCollections).values({
        collectionId,
        mediaId: item.mediaId,
        displayOrder: item.displayOrder,
      });
    } catch (error: unknown) {
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "23505") {
        throw new ConstraintError({
          message: "Media already exists in this collection",
          details: error,
        });
      }
      throw error;
    }
  },

  async removeItem(collectionId: string, mediaId: string): Promise<void> {
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
  },
};

import type {
  Collection,
  NewCollection,
  NewCollectionItem,
  UpdateCollection,
} from "@solid-imager/core/domain/collections/schemas";
import {
  ResourceConflictError,
  ResourceNotFoundError,
  UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { ICollectionRepository } from "@solid-imager/core/domain/repositories/collection-repository";
import { and, eq } from "drizzle-orm";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import { collections, mediaCollections } from "~/infrastructure/db/schema";

export const CollectionRepository: ICollectionRepository = {
  async findAll(): Promise<Collection[]> {
    return await db.select().from(collections);
  },

  async findById(id: string, tx?: Transaction): Promise<Collection | null> {
    const client = (tx as unknown as TransactionClient) || db;
    const result = await client
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);
    return result[0] || null;
  },

  async create(
    collection: NewCollection,
    tx?: Transaction
  ): Promise<Collection> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .insert(collections)
        .values(collection)
        .returning();
      return result[0];
    } catch (error: unknown) {
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "23505") {
        throw new ResourceConflictError(
          "Collection with this name already exists"
        );
      }
      throw new UnexpectedError("Failed to create collection", error);
    }
  },

  async update(
    id: string,
    updates: UpdateCollection,
    tx?: Transaction
  ): Promise<Collection> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .update(collections)
        .set(updates)
        .where(eq(collections.id, id))
        .returning();

      if (!result[0]) {
        throw new ResourceNotFoundError("Collection", id);
      }
      return result[0];
    } catch (error: unknown) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "23505") {
        throw new ResourceConflictError(
          "Collection with this name already exists"
        );
      }
      throw new UnexpectedError("Failed to update collection", error);
    }
  },

  async delete(id: string, tx?: Transaction): Promise<void> {
    const client = (tx as unknown as TransactionClient) || db;
    const result = await client
      .delete(collections)
      .where(eq(collections.id, id))
      .returning();

    if (result.length === 0) {
      throw new ResourceNotFoundError("Collection", id);
    }
  },

  async addItem(
    collectionId: string,
    item: NewCollectionItem,
    tx?: Transaction
  ): Promise<void> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      await client.insert(mediaCollections).values({
        collectionId,
        mediaId: item.mediaId,
        displayOrder: item.displayOrder,
      });
    } catch (error: unknown) {
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "23505") {
        throw new ResourceConflictError(
          "Media already exists in this collection"
        );
      }
      throw new UnexpectedError("Failed to add item to collection", error);
    }
  },

  async removeItem(
    collectionId: string,
    mediaId: string,
    tx?: Transaction
  ): Promise<void> {
    const client = (tx as unknown as TransactionClient) || db;
    const result = await client
      .delete(mediaCollections)
      .where(
        and(
          eq(mediaCollections.collectionId, collectionId),
          eq(mediaCollections.mediaId, mediaId)
        )
      )
      .returning();

    if (result.length === 0) {
      throw new ResourceNotFoundError("CollectionItem association");
    }
  },
};

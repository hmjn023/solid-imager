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
import type { ICollectionRepository } from "@solid-imager/core/domain/repositories/collection-repository";
import { and, eq } from "drizzle-orm";
import { collections, mediaCollections } from "../schema";
import type { DrizzleExecutor } from "../types";

export function createCollectionRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
): ICollectionRepository {
  return {
    async findAll(): Promise<Collection[]> {
      return await getExecutor().select().from(collections);
    },

    async findById(
      id: string,
      tx?: unknown,
    ): Promise<Collection | null> {
      const rows = await getExecutor(tx)
        .select()
        .from(collections)
        .where(eq(collections.id, id))
        .limit(1);
      return rows[0] || null;
    },

    async create(
      collection: NewCollection,
      tx?: unknown,
    ): Promise<Collection> {
      try {
        const result = await getExecutor(tx)
          .insert(collections)
          .values(collection)
          .returning();
        return result[0];
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505"
        ) {
          throw new ResourceConflictError(
            "Collection with this name already exists",
          );
        }
        throw new UnexpectedError("Failed to create collection", error);
      }
    },

    async update(
      id: string,
      updates: UpdateCollection,
      tx?: unknown,
    ): Promise<Collection> {
      try {
        const result = await getExecutor(tx)
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
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505"
        ) {
          throw new ResourceConflictError(
            "Collection with this name already exists",
          );
        }
        throw new UnexpectedError("Failed to update collection", error);
      }
    },

    async delete(id: string, tx?: unknown): Promise<void> {
      const result = await getExecutor(tx)
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
      tx?: unknown,
    ): Promise<void> {
      try {
        await getExecutor(tx)
          .insert(mediaCollections)
          .values({
            collectionId,
            mediaId: item.mediaId,
            displayOrder: item.displayOrder,
          });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505"
        ) {
          throw new ResourceConflictError(
            "Media already exists in this collection",
          );
        }
        throw new UnexpectedError("Failed to add item to collection", error);
      }
    },

    async removeItem(
      collectionId: string,
      mediaId: string,
      tx?: unknown,
    ): Promise<void> {
      const result = await getExecutor(tx)
        .delete(mediaCollections)
        .where(
          and(
            eq(mediaCollections.collectionId, collectionId),
            eq(mediaCollections.mediaId, mediaId),
          ),
        )
        .returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("CollectionItem association");
      }
    },
  };
}

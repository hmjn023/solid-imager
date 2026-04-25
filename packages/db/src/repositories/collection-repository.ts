import type {
	Collection,
	NewCollection,
	NewCollectionItem,
	UpdateCollection,
} from "@solid-imager/core/domain/collections/schemas";
import { collectionSchema } from "@solid-imager/core/domain/collections/schemas";
import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { ICollectionRepository } from "@solid-imager/core/domain/repositories/collection-repository";
import { and, asc, eq } from "drizzle-orm";
import { collections, mediaCollections } from "../schema";
import type { DrizzleExecutor } from "../types";

type DbCollection = typeof collections.$inferSelect;

export type CollectionRepositoryExecutorProvider = (
	tx?: unknown,
) => DrizzleExecutor;

type CreateCollectionRepositoryOptions = {
	orderByName?: boolean;
};

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	);
}

function mapToCollection(row: DbCollection): Collection {
	return collectionSchema.parse({
		id: row.id,
		userId: row.userId,
		name: row.name,
		description: row.description,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}

export function createCollectionRepository(
	getExecutor: CollectionRepositoryExecutorProvider,
	options: CreateCollectionRepositoryOptions = {},
): ICollectionRepository {
	return {
		async findAll(): Promise<Collection[]> {
			const query = getExecutor().select().from(collections);
			const rows = await (options.orderByName
				? query.orderBy(asc(collections.name))
				: query);
			return rows.map((row) => mapToCollection(row));
		},

		async findById(id: string): Promise<Collection | null> {
			const rows = await getExecutor()
				.select()
				.from(collections)
				.where(eq(collections.id, id))
				.limit(1);
			return rows[0] ? mapToCollection(rows[0]) : null;
		},

		async create(
			collection: NewCollection,
			tx?: unknown,
		): Promise<Collection> {
			try {
				const rows = await getExecutor(tx)
					.insert(collections)
					.values({
						name: collection.name,
						userId: collection.userId,
						description: collection.description ?? "",
					})
					.returning();
				return mapToCollection(rows[0]);
			} catch (error) {
				if (isUniqueViolation(error)) {
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
				const rows = await getExecutor(tx)
					.update(collections)
					.set({
						...(updates.name !== undefined ? { name: updates.name } : {}),
						...(updates.description !== undefined
							? { description: updates.description }
							: {}),
						updatedAt: new Date(),
					})
					.where(eq(collections.id, id))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("Collection", id);
				}
				return mapToCollection(rows[0]);
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError(
						"Collection with this name already exists",
					);
				}
				throw new UnexpectedError("Failed to update collection", error);
			}
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			const rows = await getExecutor(tx)
				.delete(collections)
				.where(eq(collections.id, id))
				.returning();

			if (rows.length === 0) {
				throw new ResourceNotFoundError("Collection", id);
			}
		},

		async addItem(
			collectionId: string,
			item: NewCollectionItem,
			tx?: unknown,
		): Promise<void> {
			try {
				await getExecutor(tx).insert(mediaCollections).values({
					collectionId,
					mediaId: item.mediaId,
					displayOrder: item.displayOrder ?? null,
				});
			} catch (error) {
				if (isUniqueViolation(error)) {
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
			const rows = await getExecutor(tx)
				.delete(mediaCollections)
				.where(
					and(
						eq(mediaCollections.collectionId, collectionId),
						eq(mediaCollections.mediaId, mediaId),
					),
				)
				.returning();

			if (rows.length === 0) {
				throw new ResourceNotFoundError("CollectionItem association");
			}
		},
	};
}

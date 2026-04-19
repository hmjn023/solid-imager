import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	MediaSource,
	NewMediaSource,
	SourceRepository,
} from "@solid-imager/core/domain/repositories/source-repository";
import { eq, type InferSelectModel } from "drizzle-orm";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import { mediaSources } from "~/infrastructure/db/schema";

type DbMediaSource = InferSelectModel<typeof mediaSources>;

function mapToMediaSource(dbSource: DbMediaSource): MediaSource {
	return {
		id: dbSource.id,
		name: dbSource.name,
		description: dbSource.description,
		type: dbSource.type as MediaSource["type"],
		connectionInfo: dbSource.connectionInfo as MediaSource["connectionInfo"],
		createdAt: dbSource.createdAt,
		updatedAt: dbSource.updatedAt,
	};
}

export class DrizzleSourceRepository implements SourceRepository {
	async findAll(): Promise<MediaSource[]> {
		try {
			const results = await db.select().from(mediaSources);
			return results.map(mapToMediaSource);
		} catch (error) {
			throw new UnexpectedError("Failed to select media sources", error);
		}
	}

	async findById(id: string, tx?: Transaction): Promise<MediaSource | null> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client.select().from(mediaSources).where(eq(mediaSources.id, id));

			if (result.length === 0) {
				return null;
			}
			return mapToMediaSource(result[0]);
		} catch (error) {
			throw new UnexpectedError(`Failed to select media source by ID: ${id}`, error);
		}
	}

	async create(source: NewMediaSource, tx?: Transaction): Promise<MediaSource> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			// Drizzle insert expects values matching the schema.
			const result = await client
				.insert(mediaSources)
				.values(source as typeof mediaSources.$inferInsert)
				.returning();
			return mapToMediaSource(result[0]);
		} catch (error: unknown) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				(error as { code: string }).code === "23505"
			) {
				throw new ResourceConflictError("Media source with this name or ID already exists");
			}
			throw new UnexpectedError("Failed to insert media source", error);
		}
	}

	async update(id: string, source: Partial<MediaSource>, tx?: Transaction): Promise<MediaSource> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client
				.update(mediaSources)
				.set(source as typeof mediaSources.$inferInsert)
				.where(eq(mediaSources.id, id))
				.returning();

			if (result.length === 0) {
				throw new ResourceNotFoundError("Media source", id);
			}
			return mapToMediaSource(result[0]);
		} catch (error) {
			if (error instanceof ResourceNotFoundError) {
				throw error;
			}
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				(error as { code: string }).code === "23505"
			) {
				throw new ResourceConflictError("Media source with this name or ID already exists");
			}
			throw new UnexpectedError(`Failed to update media source with ID: ${id}`, error);
		}
	}

	async delete(id: string, tx?: Transaction): Promise<void> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client.delete(mediaSources).where(eq(mediaSources.id, id)).returning();
			if (result.length === 0) {
				throw new ResourceNotFoundError("Media source", id);
			}
		} catch (error) {
			if (error instanceof ResourceNotFoundError) {
				throw error;
			}
			throw new UnexpectedError(`Failed to delete media source with ID: ${id}`, error);
		}
	}
}

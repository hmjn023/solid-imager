import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type {
	MediaSource,
	NewMediaSource,
	SourceRepository,
} from "@solid-imager/core/domain/repositories/source-repository";
import { asc, eq } from "drizzle-orm";
import { mediaSources } from "../schema";
import type { DrizzleExecutor } from "../types";

export type SourceRepositoryExecutorProvider = (
	tx?: unknown,
) => DrizzleExecutor;

type CreateSourceRepositoryOptions = {
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

function mapToMediaSource(row: typeof mediaSources.$inferSelect): MediaSource {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		type: row.type,
		connectionInfo: row.connectionInfo as MediaSource["connectionInfo"],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function createSourceRepository(
	getExecutor: SourceRepositoryExecutorProvider,
	options: CreateSourceRepositoryOptions = {},
): SourceRepository {
	return {
		async findAll(): Promise<MediaSource[]> {
			try {
				const query = getExecutor().select().from(mediaSources);
				const rows = options.orderByName
					? await query.orderBy(asc(mediaSources.name))
					: await query;
				return rows.map(mapToMediaSource);
			} catch (error) {
				throw new UnexpectedError("Failed to select media sources", error);
			}
		},

		async findById(id: string, tx?: unknown): Promise<MediaSource | null> {
			try {
				const rows = await getExecutor(tx)
					.select()
					.from(mediaSources)
					.where(eq(mediaSources.id, id))
					.limit(1);
				return rows[0] ? mapToMediaSource(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select media source by ID: ${id}`,
					error,
				);
			}
		},

		async create(input: NewMediaSource, tx?: unknown): Promise<MediaSource> {
			try {
				const rows = await getExecutor(tx)
					.insert(mediaSources)
					.values({
						name: input.name,
						description: input.description,
						type: input.type,
						connectionInfo: input.connectionInfo,
					})
					.returning();
				return mapToMediaSource(rows[0]);
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError(
						"Media source with this name or ID already exists",
					);
				}
				throw new UnexpectedError("Failed to insert media source", error);
			}
		},

		async update(
			id: string,
			input: Partial<MediaSource>,
			tx?: unknown,
		): Promise<MediaSource> {
			try {
				const rows = await getExecutor(tx)
					.update(mediaSources)
					.set({
						...(input.name !== undefined ? { name: input.name } : {}),
						...(input.description !== undefined
							? { description: input.description }
							: {}),
						...(input.type !== undefined ? { type: input.type } : {}),
						...(input.connectionInfo !== undefined
							? { connectionInfo: input.connectionInfo }
							: {}),
						updatedAt: new Date(),
					})
					.where(eq(mediaSources.id, id))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("Media source", id);
				}
				return mapToMediaSource(rows[0]);
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError(
						"Media source with this name or ID already exists",
					);
				}
				throw new UnexpectedError(
					`Failed to update media source with ID: ${id}`,
					error,
				);
			}
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			try {
				const rows = await getExecutor(tx)
					.delete(mediaSources)
					.where(eq(mediaSources.id, id))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("Media source", id);
				}
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(
					`Failed to delete media source with ID: ${id}`,
					error,
				);
			}
		},
	};
}

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
import { connectionInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import { isMediaSourceType } from "@solid-imager/core/utils/type-guards";
import { desc, eq, inArray, sql, type InferSelectModel } from "drizzle-orm";
import { mediaSources, sourceSyncRuns, sourceRunCutovers } from "../schema";
import type { DrizzleExecutor } from "../types";

type DbMediaSource = InferSelectModel<typeof mediaSources>;

function mapToMediaSource(dbSource: DbMediaSource): MediaSource {
	return {
		id: dbSource.id,
		name: dbSource.name,
		description: dbSource.description,
		type: isMediaSourceType(dbSource.type) ? dbSource.type : "local",
		connectionInfo: connectionInfoSchema.parse(dbSource.connectionInfo),
		createdAt: dbSource.createdAt,
		updatedAt: dbSource.updatedAt,
		syncStatus: dbSource.syncStatus,
		lastSyncStartedAt: dbSource.lastSyncStartedAt,
		lastSyncCompletedAt: dbSource.lastSyncCompletedAt,
		lastSyncError: dbSource.lastSyncError,
	};
}

export function createSourceRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): SourceRepository {
	async function summaries(
		sources: MediaSource[],
		tx?: unknown,
	): Promise<MediaSource[]> {
		if (!sources.length) return sources;
		const client = getExecutor(tx);
		const [control] = await client
			.select()
			.from(sourceRunCutovers)
			.where(eq(sourceRunCutovers.id, "79100000-0000-4000-8000-000000000001"));
		if (control?.authority !== "dedicated") return sources;
		const runs = await client
			.selectDistinctOn([sourceSyncRuns.sourceId], {
				sourceId: sourceSyncRuns.sourceId,
				status: sourceSyncRuns.status,
				startedAt: sourceSyncRuns.startedAt,
				finishedAt: sourceSyncRuns.finishedAt,
			})
			.from(sourceSyncRuns)
			.where(
				inArray(
					sourceSyncRuns.sourceId,
					sources.map((source) => source.id),
				),
			)
			.orderBy(
				sourceSyncRuns.sourceId,
				sql`CASE WHEN ${sourceSyncRuns.status} IN ('pending','in_progress') THEN 0 ELSE 1 END`,
				desc(sourceSyncRuns.updatedAt),
				desc(sourceSyncRuns.id),
			);
		const bySource = new Map(runs.map((run) => [run.sourceId, run]));
		return sources.map((source) => {
			const run = bySource.get(source.id);
			return run
				? {
						...source,
						syncStatus: ["pending", "in_progress"].includes(run.status)
							? "syncing"
							: ["failed", "blocked"].includes(run.status)
								? "error"
								: "idle",
						lastSyncStartedAt: run.startedAt,
						lastSyncCompletedAt:
							run.status === "completed"
								? run.finishedAt
								: source.lastSyncCompletedAt,
						lastSyncError: ["failed", "blocked"].includes(run.status)
							? "Directory sync failed"
							: null,
					}
				: source;
		});
	}

	return {
		async findAll(): Promise<MediaSource[]> {
			try {
				const results = await getExecutor()
					.select()
					.from(mediaSources)
					.orderBy(mediaSources.name);
				return summaries(results.map(mapToMediaSource));
			} catch (error) {
				throw new UnexpectedError("Failed to select media sources", error);
			}
		},

		async findById(id: string, tx?: unknown): Promise<MediaSource | null> {
			try {
				const result = await getExecutor(tx)
					.select()
					.from(mediaSources)
					.where(eq(mediaSources.id, id));

				if (result.length === 0) {
					return null;
				}
				return (await summaries([mapToMediaSource(result[0])], tx))[0];
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select media source by ID: ${id}`,
					error,
				);
			}
		},

		async create(source: NewMediaSource, tx?: unknown): Promise<MediaSource> {
			try {
				const result = await getExecutor(tx)
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
					throw new ResourceConflictError(
						"Media source with this name or ID already exists",
					);
				}
				throw new UnexpectedError("Failed to insert media source", error);
			}
		},

		async update(
			id: string,
			source: Partial<MediaSource>,
			tx?: unknown,
		): Promise<MediaSource> {
			try {
				const result = await getExecutor(tx)
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
				const result = await getExecutor(tx)
					.delete(mediaSources)
					.where(eq(mediaSources.id, id))
					.returning();
				if (result.length === 0) {
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

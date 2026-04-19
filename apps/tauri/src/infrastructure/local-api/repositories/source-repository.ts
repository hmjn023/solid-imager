import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	MediaSource,
	NewMediaSource,
} from "@solid-imager/core/domain/repositories/source-repository";
import { mediaSources } from "@solid-imager/db/schema";
import { asc, eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";

function getExecutor(tx?: TauriDbExecutor) {
	return tx ?? getTauriAppServices().db;
}

function toMediaSource(row: typeof mediaSources.$inferSelect): MediaSource {
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

export const TauriSourceRepository = {
	async findAll(tx?: TauriDbExecutor): Promise<MediaSource[]> {
		const rows = await getExecutor(tx).select().from(mediaSources).orderBy(asc(mediaSources.name));
		return rows.map(toMediaSource);
	},

	async findById(id: string, tx?: TauriDbExecutor): Promise<MediaSource | null> {
		const rows = await getExecutor(tx)
			.select()
			.from(mediaSources)
			.where(eq(mediaSources.id, id))
			.limit(1);
		return rows[0] ? toMediaSource(rows[0]) : null;
	},

	async create(input: NewMediaSource, tx?: TauriDbExecutor): Promise<MediaSource> {
		const rows = await getExecutor(tx)
			.insert(mediaSources)
			.values({
				name: input.name,
				description: input.description,
				type: input.type,
				connectionInfo: input.connectionInfo,
			})
			.returning();
		return toMediaSource(rows[0]);
	},

	async update(
		id: string,
		input: Partial<MediaSource>,
		tx?: TauriDbExecutor,
	): Promise<MediaSource> {
		const rows = await getExecutor(tx)
			.update(mediaSources)
			.set({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.description !== undefined ? { description: input.description } : {}),
				...(input.type !== undefined ? { type: input.type } : {}),
				...(input.connectionInfo !== undefined ? { connectionInfo: input.connectionInfo } : {}),
				updatedAt: new Date(),
			})
			.where(eq(mediaSources.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Media source", id);
		}

		return toMediaSource(rows[0]);
	},

	async delete(id: string, tx?: TauriDbExecutor): Promise<void> {
		const rows = await getExecutor(tx)
			.delete(mediaSources)
			.where(eq(mediaSources.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Media source", id);
		}
	},
};

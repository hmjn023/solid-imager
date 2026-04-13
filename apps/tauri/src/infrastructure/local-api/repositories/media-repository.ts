import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import { mediaSchema } from "@solid-imager/core/domain/media/schemas";
import { and, eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";
import { medias } from "../../../../../server/src/infrastructure/db/schema";

function getExecutor(tx?: TauriDbExecutor) {
	return tx ?? getTauriAppServices().db;
}

function toMedia(row: typeof medias.$inferSelect): Media {
	return mediaSchema.parse(row);
}

export type UpsertTauriMediaInput = {
	mediaSourceId: string;
	filePath: string;
	fileName: string;
	mediaType: "image" | "video" | "audio";
	width: number;
	height: number;
	fileSize: number | null;
	description: string | null;
	createdAt: Date;
	modifiedAt: Date;
};

export const TauriMediaRepository = {
	async findByPath(
		sourceId: string,
		filePath: string,
		tx?: TauriDbExecutor,
	): Promise<Media | null> {
		const rows = await getExecutor(tx)
			.select()
			.from(medias)
			.where(
				and(eq(medias.mediaSourceId, sourceId), eq(medias.filePath, filePath)),
			)
			.limit(1);
		return rows[0] ? toMedia(rows[0]) : null;
	},

	async findAllPathsBySourceId(
		sourceId: string,
		tx?: TauriDbExecutor,
	): Promise<Array<{ id: string; filePath: string }>> {
		return await getExecutor(tx)
			.select({
				id: medias.id,
				filePath: medias.filePath,
			})
			.from(medias)
			.where(eq(medias.mediaSourceId, sourceId));
	},

	async upsert(
		input: UpsertTauriMediaInput,
		tx?: TauriDbExecutor,
	): Promise<Media> {
		const rows = await getExecutor(tx)
			.insert(medias)
			.values({
				mediaSourceId: input.mediaSourceId,
				filePath: input.filePath,
				fileName: input.fileName,
				mediaType: input.mediaType,
				width: input.width,
				height: input.height,
				fileSize: input.fileSize,
				description: input.description,
				createdAt: input.createdAt,
				modifiedAt: input.modifiedAt,
				indexedAt: new Date(),
				status: "active",
			})
			.onConflictDoUpdate({
				target: [medias.mediaSourceId, medias.filePath],
				set: {
					fileName: input.fileName,
					mediaType: input.mediaType,
					width: input.width,
					height: input.height,
					fileSize: input.fileSize,
					description: input.description,
					createdAt: input.createdAt,
					modifiedAt: input.modifiedAt,
					indexedAt: new Date(),
					status: "active",
				},
			})
			.returning();
		return toMedia(rows[0]);
	},

	async delete(id: string, tx?: TauriDbExecutor): Promise<void> {
		const rows = await getExecutor(tx)
			.delete(medias)
			.where(eq(medias.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Media", id);
		}
	},
};

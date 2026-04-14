import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import {
	type MediaDetails,
	type MediaSearchRequest,
	type MediaSearchResponse,
	type UpdateMediaRequest,
	updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import { eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { mediaUrls } from "../../../../../server/src/infrastructure/db/schema";
import { TauriMediaRepository } from "../repositories/media-repository";

export const TauriMediaService = {
	async search(
		sourceId: string | undefined | null,
		params: MediaSearchRequest,
	): Promise<MediaSearchResponse> {
		return sourceId
			? await TauriMediaRepository.search(sourceId, params)
			: await TauriMediaRepository.globalSearch(params);
	},

	async getDetails(sourceId: string, mediaId: string): Promise<MediaDetails> {
		const details = await TauriMediaRepository.getDetails(mediaId);
		if (!details || details.mediaSourceId !== sourceId) {
			throw new ResourceNotFoundError("Media", mediaId);
		}
		return details;
	},

	async update(
		sourceId: string,
		mediaId: string,
		updates: UpdateMediaRequest,
	): Promise<MediaDetails> {
		const parsedUpdates = updateMediaRequestSchema.parse(updates);

		return await getTauriAppServices().db.transaction(async (tx) => {
			const existing = await TauriMediaRepository.findById(mediaId, tx);
			if (!existing || existing.mediaSourceId !== sourceId) {
				throw new ResourceNotFoundError("Media", mediaId);
			}

			await TauriMediaRepository.update(mediaId, parsedUpdates, tx);

			if (parsedUpdates.sourceUrls !== undefined) {
				await tx.delete(mediaUrls).where(eq(mediaUrls.mediaId, mediaId));
				await TauriMediaRepository.addUrls(
					mediaId,
					parsedUpdates.sourceUrls,
					tx,
				);
			}

			const details = await TauriMediaRepository.getDetails(mediaId, tx);
			if (!details) {
				throw new ResourceNotFoundError("Media", mediaId);
			}
			return details;
		});
	},
};

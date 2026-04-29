import { createCollectionService } from "@solid-imager/application/services/collection-service";
import type {
	Collection,
	NewCollection,
	UpdateCollection,
} from "@solid-imager/core/domain/collections/schemas";
import { TauriCollectionRepository } from "../repositories/collection-repository";

const collectionService = createCollectionService(TauriCollectionRepository);

export const TauriCollectionService = {
	async list(): Promise<Collection[]> {
		return await collectionService.getAllCollections();
	},

	async get(id: string): Promise<Collection | null> {
		return await collectionService.getCollectionDetails(id);
	},

	async create(input: NewCollection): Promise<Collection> {
		return await collectionService.createCollection(input);
	},

	async update(id: string, input: UpdateCollection): Promise<Collection> {
		return await collectionService.updateCollection(id, input);
	},

	async delete(id: string): Promise<void> {
		await collectionService.deleteCollection(id);
	},

	async addToMedia(
		collectionId: string,
		mediaId: string,
		displayOrder?: number,
	): Promise<void> {
		await collectionService.addMediaToCollection(collectionId, {
			mediaId,
			displayOrder,
		});
	},

	async removeFromMedia(collectionId: string, mediaId: string): Promise<void> {
		await collectionService.removeMediaFromCollection(collectionId, mediaId);
	},
};

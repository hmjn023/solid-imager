import { createCollectionService } from "@solid-imager/application/services/collection-service";
import type {
	Collection,
	NewCollection,
	NewCollectionItem,
	UpdateCollection,
} from "@solid-imager/core/domain/collections/schemas";
import { TauriCollectionRepository } from "../repositories/collection-repository";

const collectionService = createCollectionService(TauriCollectionRepository);

export const TauriCollectionService = {
	async list(): Promise<Collection[]> {
		return await collectionService.list();
	},

	async get(id: string): Promise<Collection | null> {
		return await collectionService.get(id);
	},

	async create(input: NewCollection): Promise<Collection> {
		return await collectionService.create(input);
	},

	async update(id: string, input: UpdateCollection): Promise<Collection> {
		return await collectionService.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await collectionService.delete(id);
	},

	async addToMedia(
		collectionId: string,
		item: NewCollectionItem,
	): Promise<void> {
		await collectionService.addToMedia(collectionId, item);
	},

	async removeFromMedia(collectionId: string, mediaId: string): Promise<void> {
		await collectionService.removeFromMedia(collectionId, mediaId);
	},
};

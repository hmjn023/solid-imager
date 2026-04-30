import type {
	Collection,
	NewCollection,
	NewCollectionItem,
	UpdateCollection,
} from "@solid-imager/core/domain/collections/schemas";
import type { ICollectionRepository } from "@solid-imager/core/domain/repositories/collection-repository";

export type CollectionService = ReturnType<typeof createCollectionService>;

export function createCollectionService(repository: ICollectionRepository) {
	return {
		async list(): Promise<Collection[]> {
			return await repository.findAll();
		},

		async get(id: string): Promise<Collection | null> {
			return await repository.findById(id);
		},

		async create(input: NewCollection): Promise<Collection> {
			return await repository.create(input);
		},

		async update(id: string, input: UpdateCollection): Promise<Collection> {
			return await repository.update(id, input);
		},

		async delete(id: string): Promise<void> {
			await repository.delete(id);
		},

		async addToMedia(collectionId: string, item: NewCollectionItem): Promise<void> {
			await repository.addItem(collectionId, item);
		},

		async removeFromMedia(collectionId: string, mediaId: string): Promise<void> {
			await repository.removeItem(collectionId, mediaId);
		},
	};
}

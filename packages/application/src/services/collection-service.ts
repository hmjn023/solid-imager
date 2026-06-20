import type {
	NewCollection,
	NewCollectionItem,
	UpdateCollection,
} from "@solid-imager/core/domain/collections/schemas";
import type { ICollectionRepository } from "@solid-imager/core/domain/repositories/collection-repository";
import type { ICollectionService } from "../ports/collection-service";

export function createCollectionService(
	repo: ICollectionRepository,
): ICollectionService {
	return {
		getAll: () => repo.findAll(),
		getById: async (id: string) => (await repo.findById(id)) ?? undefined,
		create: (data: NewCollection) => repo.create(data),
		update: (id: string, data: UpdateCollection) => repo.update(id, data),
		delete: (id: string) => repo.delete(id),
		addItem: (id: string, item: NewCollectionItem) => repo.addItem(id, item),
		removeItem: (id: string, mediaId: string) => repo.removeItem(id, mediaId),
	};
}

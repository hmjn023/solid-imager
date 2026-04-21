/**
 * CollectionService - コレクション管理機能
 * Feature 14: コレクション管理機能
 */

import { createCollectionService } from "@solid-imager/application/services/collection-service";
import type { NewCollectionItem } from "@solid-imager/core/domain/collections/schemas";
/**
 * Provides services for managing media collections.
 */
import { CollectionRepository } from "~/infrastructure/repositories/collection-repository";

/**
 * Provides services for managing media collections.
 */
const collectionService = createCollectionService(CollectionRepository);

export const CollectionService = {
	/**
	 * Retrieves all collections.
	 */
	async getAllCollections() {
		return await collectionService.getAllCollections();
	},

	/**
	 * Creates a new collection.
	 */
	async createCollection(collectionData: {
		userId: string;
		name: string;
		description?: string;
	}) {
		return await collectionService.createCollection({
			userId: collectionData.userId,
			name: collectionData.name,
			description: collectionData.description,
		});
	},

	/**
	 * Retrieves details of a specific collection by its ID.
	 */
	async getCollectionDetails(collectionId: string) {
		return await collectionService.getCollectionDetails(collectionId);
	},

	/**
	 * Updates an existing collection.
	 */
	async updateCollection(
		collectionId: string,
		collectionData: {
			userId?: string;
			name?: string;
			description?: string;
		},
	) {
		return await collectionService.updateCollection(
			collectionId,
			collectionData,
		);
	},

	/**
	 * Deletes a collection by its ID.
	 */
	async deleteCollection(collectionId: string) {
		return await collectionService.deleteCollection(collectionId);
	},

	/**
	 * Adds a media item to a specific collection.
	 */
	async addMediaToCollection(
		collectionId: string,
		mediaId: string,
		displayOrder?: number,
	) {
		const item: NewCollectionItem = {
			mediaId,
			displayOrder,
		};
		return await collectionService.addMediaToCollection(collectionId, item);
	},

	/**
	 * Removes a media item from a specific collection.
	 */
	async removeMediaFromCollection(collectionId: string, mediaId: string) {
		return await collectionService.removeMediaFromCollection(
			collectionId,
			mediaId,
		);
	},
};

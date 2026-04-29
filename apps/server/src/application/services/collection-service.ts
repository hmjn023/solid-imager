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
	async list() {
		return await collectionService.list();
	},

	/**
	 * Creates a new collection.
	 */
	async create(collectionData: {
		userId: string;
		name: string;
		description?: string;
	}) {
		return await collectionService.create({
			userId: collectionData.userId,
			name: collectionData.name,
			description: collectionData.description,
		});
	},

	/**
	 * Retrieves details of a specific collection by its ID.
	 */
	async get(collectionId: string) {
		return await collectionService.get(collectionId);
	},

	/**
	 * Updates an existing collection.
	 */
	async update(
		collectionId: string,
		collectionData: {
			userId?: string;
			name?: string;
			description?: string;
		},
	) {
		return await collectionService.update(collectionId, collectionData);
	},

	/**
	 * Deletes a collection by its ID.
	 */
	async delete(collectionId: string) {
		return await collectionService.delete(collectionId);
	},

	/**
	 * Adds a media item to a specific collection.
	 */
	async addToMedia(
		collectionId: string,
		mediaId: string,
		displayOrder?: number,
	) {
		const item: NewCollectionItem = {
			mediaId,
			displayOrder,
		};
		return await collectionService.addToMedia(collectionId, item);
	},

	/**
	 * Removes a media item from a specific collection.
	 */
	async removeFromMedia(collectionId: string, mediaId: string) {
		return await collectionService.removeFromMedia(collectionId, mediaId);
	},
};

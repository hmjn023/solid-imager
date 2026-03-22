/**
 * Categories API Client
 *
 * NOTE: Migrated to use oRPC ✅
 */

import { orpc } from "~/infrastructure/api-clients/orpc-client";

export function fetchAllCategories() {
	return orpc.categories.list();
}

export function fetchCategory(id: string) {
	return orpc.categories.get({ id });
}

export function createCategory(data: { name: string; description?: string }) {
	return orpc.categories.create(data);
}

export function updateCategory(
	id: string,
	data: { name?: string; description?: string },
) {
	return orpc.categories.update({ id, data });
}

export function deleteCategory(id: string) {
	return orpc.categories.delete({ id });
}

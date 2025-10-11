/**
 * Categories API Client
 * Extracted from src/lib/api/categories.ts
 */

export function getCategories() {
	return [];
}

export function createCategory(data: {
	name: string;
	description?: string;
	color?: string;
	parentId?: number;
}) {
	const { name, description, color, parentId } = data;
	return { id: 1, name, description, color, parentId };
}

export function getCategoryById(id: number) {
	return {
		id,
		name: `Category ${id}`,
		description: `Description for category ${id}`,
	};
}

export function updateCategory(
	id: number,
	data: {
		name?: string;
		description?: string;
		color?: string;
		parentId?: number;
	},
) {
	const { name, description } = data;
	return {
		id,
		name: name || `Category ${id}`,
		description: description || `Description for category ${id}`,
	};
}

export function deleteCategory(_id: number) {
	return { success: true };
}

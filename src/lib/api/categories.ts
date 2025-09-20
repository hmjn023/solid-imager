export async function getCategories() {
	console.log("Placeholder: getCategories called");
	return [];
}

export async function createCategory(
	name: string,
	description?: string,
	color?: string,
	parentId?: number,
) {
	console.log("Placeholder: createCategory called", {
		name,
		description,
		color,
		parentId,
	});
	return { id: 1, name, description, color, parentId };
}

export async function getCategoryById(id: number) {
	console.log("Placeholder: getCategoryById called", { id });
	return {
		id,
		name: `Category ${id}`,
		description: `Description for category ${id}`,
	};
}

export async function updateCategory(
	id: number,
	name?: string,
	description?: string,
	color?: string,
	parentId?: number,
) {
	console.log("Placeholder: updateCategory called", {
		id,
		name,
		description,
		color,
		parentId,
	});
	return {
		id,
		name: name || `Category ${id}`,
		description: description || `Description for category ${id}`,
	};
}

export async function deleteCategory(id: number) {
	console.log("Placeholder: deleteCategory called", { id });
	return { success: true };
}

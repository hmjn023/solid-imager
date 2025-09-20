export async function getTags() {
	console.log("Placeholder: getTags called");
	return [];
}

export async function createTag(
	name: string,
	description?: string,
	attribute?: string,
	color?: string,
) {
	console.log("Placeholder: createTag called", {
		name,
		description,
		attribute,
		color,
	});
	return { id: 1, name, description, attribute, color };
}

export async function getTagById(id: number) {
	console.log("Placeholder: getTagById called", { id });
	return { id, name: `Tag ${id}`, description: `Description for tag ${id}` };
}

export async function updateTag(
	id: number,
	name?: string,
	description?: string,
	attribute?: string,
	color?: string,
) {
	console.log("Placeholder: updateTag called", {
		id,
		name,
		description,
		attribute,
		color,
	});
	return {
		id,
		name: name || `Tag ${id}`,
		description: description || `Description for tag ${id}`,
	};
}

export async function deleteTag(id: number) {
	console.log("Placeholder: deleteTag called", { id });
	return { success: true };
}

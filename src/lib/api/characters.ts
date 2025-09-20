export async function getCharacters() {
	console.log("Placeholder: getCharacters called");
	return [];
}

export async function createCharacter(
	name: string,
	ipId?: number,
	description?: string,
) {
	console.log("Placeholder: createCharacter called", {
		name,
		ipId,
		description,
	});
	return { id: 1, name, ipId, description };
}

export async function getCharacterById(id: number) {
	console.log("Placeholder: getCharacterById called", { id });
	return {
		id,
		name: `Character ${id}`,
		description: `Description for character ${id}`,
	};
}

export async function updateCharacter(
	id: number,
	name?: string,
	ipId?: number,
	description?: string,
) {
	console.log("Placeholder: updateCharacter called", {
		id,
		name,
		ipId,
		description,
	});
	return {
		id,
		name: name || `Character ${id}`,
		description: description || `Description for character ${id}`,
	};
}

export async function deleteCharacter(id: number) {
	console.log("Placeholder: deleteCharacter called", { id });
	return { success: true };
}

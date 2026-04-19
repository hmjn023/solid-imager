import { orpc } from "./orpc-client";

export function fetchAllCharacters() {
	return orpc.characters.list();
}

export function createCharacter(data: {
	name: string;
	description?: string;
	ipIds?: string[];
}) {
	return orpc.characters.create(data);
}

export function updateCharacter(
	id: string,
	data: { name?: string; description?: string; ipIds?: string[] },
) {
	return orpc.characters.update({ id, data });
}

export function deleteCharacter(id: string) {
	return orpc.characters.delete({ id });
}

export function addCharacterToMedia(
	_sourceId: string,
	mediaId: string,
	characterId: string,
) {
	return orpc.characters.addToMedia({ mediaId, characterId });
}

export function removeCharacterFromMedia(
	_sourceId: string,
	mediaId: string,
	characterId: string,
) {
	return orpc.characters.removeFromMedia({ mediaId, characterId });
}

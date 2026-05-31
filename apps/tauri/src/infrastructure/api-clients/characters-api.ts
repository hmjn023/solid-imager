export { fetchAllCharacters } from "~/api/entities-api";

import { client } from "~/orpc-client";

export function createCharacter(data: { name: string; description?: string; ipIds?: string[] }) {
	return client.characters.create(data);
}

export function updateCharacter(id: string, data: { name?: string; description?: string; ipIds?: string[] }) {
	return client.characters.update({ id, data });
}

export async function deleteCharacter(id: string) {
	await client.characters.delete({ id });
}

export async function addCharacterToMedia(mediaId: string, characterId: string) {
	await client.characters.addToMedia({ mediaId, characterId });
}

export async function removeCharacterFromMedia(mediaId: string, characterId: string) {
	await client.characters.removeFromMedia({ mediaId, characterId });
}

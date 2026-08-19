import { implement } from "@orpc/server";
import { charactersContract } from "@solid-imager/core/domain/contract/characters.contract";
import { CharacterService } from "~/infrastructure/services/character-service";
import { getCharacterMediaCounts } from "./entity-media-counts";

/**
 * Characters Router Implementation
 */
const os = implement(charactersContract);

export const charactersRouter = os.router({
	list: os.list.handler(async () => {
		const characters = await CharacterService.getAllCharacters();
		const mediaCounts = await getCharacterMediaCounts(
			characters.map((character) => character.id),
		);
		return characters.map((character) => ({
			...character,
			mediaCount: mediaCounts.get(character.id) ?? 0,
		}));
	}),

	get: os.get.handler(async ({ input }) => {
		const character = await CharacterService.getCharacterDetails(input.id);
		if (!character) {
			throw new Error(`Character not found: ${input.id}`);
		}
		return character;
	}),

	create: os.create.handler(({ input }) =>
		CharacterService.createCharacter(input),
	),

	update: os.update.handler(async ({ input }) => {
		const updated = await CharacterService.updateCharacter(
			input.id,
			input.data,
		);
		if (!updated) {
			throw new Error(`Character not found: ${input.id}`);
		}
		return updated;
	}),

	delete: os.delete.handler(({ input }) =>
		CharacterService.deleteCharacter(input.id),
	),

	// Media association
	listForMedia: os.listForMedia.handler(({ input }) =>
		CharacterService.getCharactersForMedia(input.mediaId),
	),

	addToMedia: os.addToMedia.handler(async ({ input }) => {
		await CharacterService.addCharacterToMedia(
			input.mediaId,
			input.characterId,
		);
		return { success: true };
	}),

	removeFromMedia: os.removeFromMedia.handler(async ({ input }) => {
		await CharacterService.removeCharacterFromMedia(
			input.mediaId,
			input.characterId,
		);
		return { success: true };
	}),
});

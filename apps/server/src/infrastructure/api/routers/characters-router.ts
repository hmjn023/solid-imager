import { os } from "@orpc/server";
import {
	newCharacterSchema,
	updateCharacterSchema,
} from "@solid-imager/core/domain/characters/schemas";
import { z } from "zod";
import { CharacterService } from "~/application/services/character-service";
import { getCharacterMediaCounts } from "./entity-media-counts";

/**
 * Characters Router Implementation
 */
export const charactersRouter = {
	list: os.handler(async () => {
		const characters = await CharacterService.getAllCharacters();
		const mediaCounts = await getCharacterMediaCounts(
			characters.map((character) => character.id),
		);
		return characters.map((character) => ({
			...character,
			mediaCount: mediaCounts.get(character.id) ?? 0,
		}));
	}),

	get: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ input }) => {
			const character = await CharacterService.getCharacterDetails(input.id);
			if (!character) {
				throw new Error(`Character not found: ${input.id}`);
			}
			return character;
		}),

	create: os
		.input(newCharacterSchema)
		.handler(({ input }) => CharacterService.createCharacter(input)),

	update: os
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateCharacterSchema,
			}),
		)
		.handler(async ({ input }) => {
			const updated = await CharacterService.updateCharacter(
				input.id,
				input.data,
			);
			if (!updated) {
				throw new Error(`Character not found: ${input.id}`);
			}
			return updated;
		}),

	delete: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(({ input }) => CharacterService.deleteCharacter(input.id)),

	// Media association
	listForMedia: os
		.input(z.object({ mediaId: z.string().uuid() }))
		.handler(({ input }) =>
			CharacterService.getCharactersForMedia(input.mediaId),
		),

	addToMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			await CharacterService.addCharacterToMedia(
				input.mediaId,
				input.characterId,
			);
			return { success: true };
		}),

	removeFromMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			await CharacterService.removeCharacterFromMedia(
				input.mediaId,
				input.characterId,
			);
			return { success: true };
		}),
};

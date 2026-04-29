import { os } from "@orpc/server";
import {
	newCharacterSchema,
	updateCharacterSchema,
} from "@solid-imager/core/domain/characters/schemas";
import { z } from "zod";
import { CharacterService } from "~/application/services/character-service";

/**
 * Characters Router Implementation
 */
export const charactersRouter = {
	list: os.handler(() => CharacterService.list()),

	get: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ input }) => {
			const character = await CharacterService.get(input.id);
			if (!character) {
				throw new Error(`Character not found: ${input.id}`);
			}
			return character;
		}),

	create: os
		.input(newCharacterSchema)
		.handler(({ input }) => CharacterService.create(input)),

	update: os
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateCharacterSchema,
			}),
		)
		.handler(async ({ input }) => {
			const updated = await CharacterService.update(input.id, input.data);
			if (!updated) {
				throw new Error(`Character not found: ${input.id}`);
			}
			return updated;
		}),

	delete: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(({ input }) => CharacterService.delete(input.id)),

	// Media association
	listForMedia: os
		.input(z.object({ mediaId: z.string().uuid() }))
		.handler(({ input }) => CharacterService.listForMedia(input.mediaId)),

	addToMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			await CharacterService.addToMedia(input.mediaId, input.characterId);
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
			await CharacterService.removeFromMedia(input.mediaId, input.characterId);
			return { success: true };
		}),
};

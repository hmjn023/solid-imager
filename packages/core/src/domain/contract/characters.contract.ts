import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	characterSchema,
	newCharacterSchema,
	updateCharacterSchema,
} from "../characters/schemas";

export const charactersContract = {
	list: oc.output(z.array(characterSchema)),

	get: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(characterSchema),

	create: oc
		.input(newCharacterSchema)
		.output(characterSchema),

	update: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateCharacterSchema,
			}),
		)
		.output(characterSchema),

	delete: oc
		.input(z.object({ id: z.string().uuid() })),

	listForMedia: oc
		.input(z.object({ mediaId: z.string().uuid() }))
		.output(z.array(characterSchema)),

	addToMedia: oc
		.input(
			z.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),

	removeFromMedia: oc
		.input(
			z.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			}),
		)
		.output(z.object({ success: z.boolean() })),
};

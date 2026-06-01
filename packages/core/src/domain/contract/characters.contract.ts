import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	newCharacterSchema,
	updateCharacterSchema,
} from "../characters/schemas";

export const charactersContract = {
	list: oc,

	get: oc
		.input(z.object({ id: z.string().uuid() })),

	create: oc
		.input(newCharacterSchema),

	update: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateCharacterSchema,
			}),
		),

	delete: oc
		.input(z.object({ id: z.string().uuid() })),

	listForMedia: oc
		.input(z.object({ mediaId: z.string().uuid() })),

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

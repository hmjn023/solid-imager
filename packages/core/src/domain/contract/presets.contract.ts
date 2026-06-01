import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	createPresetRequestSchema,
	updatePresetRequestSchema,
} from "../media/schemas";

export const presetsContract = {
	list: oc,

	get: oc
		.input(z.object({ id: z.number().int() })),

	getByName: oc
		.input(z.object({ name: z.string() })),

	create: oc
		.input(createPresetRequestSchema),

	update: oc
		.input(
			z.object({
				id: z.number().int(),
				data: updatePresetRequestSchema,
			}),
		),

	delete: oc
		.input(z.object({ id: z.number().int() }))
		.output(z.object({ success: z.boolean() })),
};

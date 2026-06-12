import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	createPresetRequestSchema,
	presetSchema,
	updatePresetRequestSchema,
} from "../media/schemas";

export const presetsContract = {
	list: oc
		.output(z.array(presetSchema)),

	get: oc
		.input(z.object({ id: z.number().int() }))
		.output(presetSchema),

	getByName: oc
		.input(z.object({ name: z.string() }))
		.output(presetSchema.nullable()),

	create: oc
		.input(createPresetRequestSchema)
		.output(presetSchema),

	update: oc
		.input(
			z.object({
				id: z.number().int(),
				data: updatePresetRequestSchema,
			}),
		)
		.output(presetSchema),

	delete: oc
		.input(z.object({ id: z.number().int() }))
		.output(z.object({ success: z.boolean() })),
};

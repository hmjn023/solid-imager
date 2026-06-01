import { oc } from "@orpc/contract";
import { z } from "zod";
import { newTagSchema, tagResponseSchema, updateTagSchema } from "../tags/schemas";

export const tagsContract = {
	list: oc
		.output(z.array(tagResponseSchema)),

	get: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(tagResponseSchema),

	create: oc
		.input(newTagSchema)
		.output(tagResponseSchema),

	update: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateTagSchema,
			}),
		)
		.output(tagResponseSchema),

	delete: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(z.object({ success: z.boolean() })),
};

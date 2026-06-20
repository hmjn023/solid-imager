import { oc } from "@orpc/contract";
import { z } from "zod";
import { newCategorySchema, updateCategorySchema } from "../categories/schemas";

export const categoriesContract = {
	list: oc,

	get: oc.input(z.object({ id: z.string().uuid() })),

	create: oc.input(newCategorySchema),

	update: oc.input(
		z.object({
			id: z.string().uuid(),
			data: updateCategorySchema,
		}),
	),

	delete: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(z.object({ success: z.boolean() })),
};

import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	mediaSourceInfoSchema,
	mediaSourceStatusSchema,
	safeMediaSourceSchema,
} from "../sources/schemas";

export const sourcesContract = {
	list: oc
		.output(z.array(safeMediaSourceSchema)),

	get: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(safeMediaSourceSchema),

	create: oc
		.input(mediaSourceInfoSchema)
		.output(safeMediaSourceSchema),

	update: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: mediaSourceInfoSchema.partial(),
			}),
		)
		.output(safeMediaSourceSchema),

	delete: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(z.object({ success: z.boolean() })),

	sync: oc
		.input(z.object({ ids: z.array(z.string().uuid()) }))
		.output(
			z.object({
				results: z.array(
					z.object({
						id: z.string(),
						success: z.boolean(),
						error: z.string().optional(),
					}),
				),
			}),
		),

	dump: oc
		.input(
			z.object({
				id: z.string().uuid(),
				mode: z.enum(["json", "zip", "lancedb"]).default("json"),
				includeImages: z.boolean().optional().default(false),
			}),
		),

	restore: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: z.array(z.any()),
			}),
		),

	importZip: oc
		.input(
			z.object({
				id: z.string().uuid(),
				file: z.instanceof(File),
			}),
		),

	importLanceDB: oc
		.input(
			z.object({
				id: z.string().uuid(),
				file: z.instanceof(File),
			}),
		),

	status: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(mediaSourceStatusSchema),
};

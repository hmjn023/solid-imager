import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	newProjectSchema,
	projectSchema,
	updateProjectSchema,
} from "../projects/schemas";

export const projectsContract = {
	list: oc.output(z.array(projectSchema)),

	get: oc.input(z.object({ id: z.string().uuid() })).output(projectSchema),

	create: oc.input(newProjectSchema).output(projectSchema),

	update: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateProjectSchema,
			}),
		)
		.output(projectSchema),

	delete: oc.input(z.object({ id: z.string().uuid() })),

	listForMedia: oc
		.input(z.object({ mediaId: z.string().uuid() }))
		.output(z.array(projectSchema)),

	addToMedia: oc.input(
		z.object({
			mediaId: z.string().uuid(),
			projectId: z.string().uuid(),
		}),
	),

	removeFromMedia: oc.input(
		z.object({
			mediaId: z.string().uuid(),
			projectId: z.string().uuid(),
		}),
	),
};

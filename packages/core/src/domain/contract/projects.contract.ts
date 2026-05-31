import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	newProjectSchema,
	updateProjectSchema,
} from "../projects/schemas";

export const projectsContract = {
	list: oc,

	get: oc
		.input(z.object({ id: z.string().uuid() })),

	create: oc
		.input(newProjectSchema),

	update: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: updateProjectSchema,
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
				projectId: z.string().uuid(),
			}),
		),

	removeFromMedia: oc
		.input(
			z.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			}),
		),
};

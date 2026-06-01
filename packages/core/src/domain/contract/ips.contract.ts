import { oc } from "@orpc/contract";
import { z } from "zod";

export const ipsContract = {
	list: oc,

	get: oc
		.input(z.object({ id: z.string().uuid() })),

	create: oc
		.input(
			z.object({
				name: z.string(),
				description: z.string().optional(),
			}),
		),

	update: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: z.object({
					name: z.string().optional(),
					description: z.string().optional(),
				}),
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
				ipId: z.string().uuid(),
			}),
		),

	removeFromMedia: oc
		.input(
			z.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			}),
		),
};

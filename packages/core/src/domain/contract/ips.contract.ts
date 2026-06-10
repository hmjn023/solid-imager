import { oc } from "@orpc/contract";
import { z } from "zod";
import { ipSchema } from "../ips/schemas";

export const ipsContract = {
	list: oc.output(z.array(ipSchema)),

	get: oc
		.input(z.object({ id: z.string().uuid() }))
		.output(ipSchema),

	create: oc
		.input(
			z.object({
				name: z.string(),
				description: z.string().optional(),
			}),
		)
		.output(ipSchema),

	update: oc
		.input(
			z.object({
				id: z.string().uuid(),
				data: z.object({
					name: z.string().optional(),
					description: z.string().optional(),
				}),
			}),
		)
		.output(ipSchema),

	delete: oc
		.input(z.object({ id: z.string().uuid() })),

	listForMedia: oc
		.input(z.object({ mediaId: z.string().uuid() }))
		.output(z.array(ipSchema)),

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

import { os } from "@orpc/server";
import { z } from "zod";
import { IpService } from "~/application/services/ip-service";

/**
 * IPs Router Implementation
 */
export const ipsRouter = {
	list: os.handler(() => IpService.list()),

	get: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ input }) => {
			const ip = await IpService.get(input.id);
			if (!ip) {
				throw new Error(`IP not found: ${input.id}`);
			}
			return ip;
		}),

	create: os
		.input(
			z.object({
				name: z.string(),
				description: z.string().optional(),
			}),
		)
		.handler(({ input }) => IpService.create(input)),

	update: os
		.input(
			z.object({
				id: z.string().uuid(),
				data: z.object({
					name: z.string().optional(),
					description: z.string().optional(),
				}),
			}),
		)
		.handler(async ({ input }) => {
			const updated = await IpService.update(input.id, input.data);
			if (!updated) {
				throw new Error(`IP not found: ${input.id}`);
			}
			return updated;
		}),

	delete: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(({ input }) => IpService.delete(input.id)),

	// Media association
	listForMedia: os
		.input(z.object({ mediaId: z.string().uuid() }))
		.handler(({ input }) => IpService.listForMedia(input.mediaId)),

	addToMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			}),
		)
		.handler(({ input }) => IpService.addToMedia(input.mediaId, input.ipId)),

	removeFromMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			}),
		)
		.handler(({ input }) =>
			IpService.removeFromMedia(input.mediaId, input.ipId),
		),
};

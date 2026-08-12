import { os } from "@orpc/server";
import { z } from "zod";
import { IpService } from "~/application/services/ip-service";
import { getIpMediaCounts } from "./entity-media-counts";

/**
 * IPs Router Implementation
 */
export const ipsRouter = {
	list: os.handler(async () => {
		const ips = await IpService.getAllIps();
		const mediaCounts = await getIpMediaCounts(ips.map((ip) => ip.id));
		return ips.map((ip) => ({
			...ip,
			mediaCount: mediaCounts.get(ip.id) ?? 0,
		}));
	}),

	get: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ input }) => {
			const ip = await IpService.getIpDetails(input.id);
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
		.handler(({ input }) => IpService.createIp(input)),

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
			const updated = await IpService.updateIp(input.id, input.data);
			if (!updated) {
				throw new Error(`IP not found: ${input.id}`);
			}
			return updated;
		}),

	delete: os
		.input(z.object({ id: z.string().uuid() }))
		.handler(({ input }) => IpService.deleteIp(input.id)),

	// Media association
	listForMedia: os
		.input(z.object({ mediaId: z.string().uuid() }))
		.handler(({ input }) => IpService.getIpsForMedia(input.mediaId)),

	addToMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			}),
		)
		.handler(({ input }) => IpService.addIpToMedia(input.mediaId, input.ipId)),

	removeFromMedia: os
		.input(
			z.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			}),
		)
		.handler(({ input }) =>
			IpService.removeIpFromMedia(input.mediaId, input.ipId),
		),
};

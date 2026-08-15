import { implement } from "@orpc/server";
import { ipsContract } from "@solid-imager/core/domain/contract/ips.contract";
import { IpService } from "~/infrastructure/services/ip-service";
import { getIpMediaCounts } from "./entity-media-counts";

/**
 * IPs Router Implementation
 */
const os = implement(ipsContract);

export const ipsRouter = os.router({
	list: os.list.handler(async () => {
		const ips = await IpService.getAllIps();
		const mediaCounts = await getIpMediaCounts(ips.map((ip) => ip.id));
		return ips.map((ip) => ({
			...ip,
			mediaCount: mediaCounts.get(ip.id) ?? 0,
		}));
	}),

	get: os.get.handler(async ({ input }) => {
		const ip = await IpService.getIpDetails(input.id);
		if (!ip) {
			throw new Error(`IP not found: ${input.id}`);
		}
		return ip;
	}),

	create: os.create.handler(({ input }) => IpService.createIp(input)),

	update: os.update.handler(async ({ input }) => {
		const updated = await IpService.updateIp(input.id, input.data);
		if (!updated) {
			throw new Error(`IP not found: ${input.id}`);
		}
		return updated;
	}),

	delete: os.delete.handler(({ input }) => IpService.deleteIp(input.id)),

	// Media association
	listForMedia: os.listForMedia.handler(({ input }) =>
		IpService.getIpsForMedia(input.mediaId),
	),

	addToMedia: os.addToMedia.handler(({ input }) =>
		IpService.addIpToMedia(input.mediaId, input.ipId),
	),

	removeFromMedia: os.removeFromMedia.handler(({ input }) =>
		IpService.removeIpFromMedia(input.mediaId, input.ipId),
	),
});

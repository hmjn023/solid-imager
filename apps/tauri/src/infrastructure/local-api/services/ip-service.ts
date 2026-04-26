import { createIpService } from "@solid-imager/application/services/ip-service";
import type { Ip, NewIp, UpdateIp } from "@solid-imager/core/domain/ips/schemas";
import { TauriIpRepository } from "../repositories/ip-repository";

const ipService = createIpService(TauriIpRepository);

export const TauriIpService = {
	async list(): Promise<Ip[]> {
		return await ipService.getAllIps();
	},

	async get(id: string): Promise<Ip | null> {
		return await ipService.getIpDetails(id);
	},

	async create(input: NewIp): Promise<Ip> {
		return await ipService.createIp(input);
	},

	async update(id: string, input: UpdateIp): Promise<Ip> {
		return await ipService.updateIp(id, input);
	},

	async delete(id: string): Promise<void> {
		await ipService.deleteIp(id);
	},

	async listForMedia(mediaId: string): Promise<Ip[]> {
		return await ipService.getIpsForMedia(mediaId);
	},

	async addToMedia(mediaId: string, ipId: string): Promise<void> {
		await ipService.addIpToMedia(mediaId, ipId);
	},

	async removeFromMedia(mediaId: string, ipId: string): Promise<void> {
		await ipService.removeIpFromMedia(mediaId, ipId);
	},
};

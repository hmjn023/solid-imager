import { createIpService } from "@solid-imager/application/services/ip-service";
import type { Ip, NewIp, UpdateIp } from "@solid-imager/core/domain/ips/schemas";
import { TauriIpRepository } from "../repositories/ip-repository";

const ipService = createIpService(TauriIpRepository);

export const TauriIpService = {
	async list(): Promise<Ip[]> {
		return await ipService.list();
	},

	async get(id: string): Promise<Ip | null> {
		return await ipService.get(id);
	},

	async create(input: NewIp): Promise<Ip> {
		return await ipService.create(input);
	},

	async update(id: string, input: UpdateIp): Promise<Ip> {
		return await ipService.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await ipService.delete(id);
	},

	async listForMedia(mediaId: string): Promise<Ip[]> {
		return await ipService.listForMedia(mediaId);
	},

	async addToMedia(mediaId: string, ipId: string): Promise<void> {
		await ipService.addToMedia(mediaId, ipId);
	},

	async removeFromMedia(mediaId: string, ipId: string): Promise<void> {
		await ipService.removeFromMedia(mediaId, ipId);
	},
};

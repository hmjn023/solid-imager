import type { Ip, NewIp, UpdateIp } from "@solid-imager/core/domain/ips/schemas";
import { TauriIpRepository } from "../repositories/ip-repository";

export const TauriIpService = {
	async list(): Promise<Ip[]> {
		return await TauriIpRepository.findAll();
	},

	async get(id: string): Promise<Ip | null> {
		return await TauriIpRepository.findById(id);
	},

	async create(input: NewIp): Promise<Ip> {
		return await TauriIpRepository.create(input);
	},

	async update(id: string, input: UpdateIp): Promise<Ip> {
		return await TauriIpRepository.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await TauriIpRepository.delete(id);
	},

	async listForMedia(mediaId: string): Promise<Ip[]> {
		return await TauriIpRepository.findByMediaId(mediaId);
	},

	async addToMedia(mediaId: string, ipId: string): Promise<void> {
		await TauriIpRepository.addMedia(mediaId, ipId);
	},

	async removeFromMedia(mediaId: string, ipId: string): Promise<void> {
		await TauriIpRepository.removeMedia(mediaId, ipId);
	},
};

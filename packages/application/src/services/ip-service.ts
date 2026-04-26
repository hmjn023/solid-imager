import type { Ip, NewIp, UpdateIp } from "@solid-imager/core/domain/ips/schemas";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";

export type IpService = ReturnType<typeof createIpService>;

export function createIpService(repository: IIpRepository) {
	return {
		async getAllIps(): Promise<Ip[]> {
			return await repository.findAll();
		},

		async getIpDetails(id: string): Promise<Ip | null> {
			return await repository.findById(id);
		},

		async createIp(input: NewIp): Promise<Ip> {
			return await repository.create(input);
		},

		async updateIp(id: string, input: UpdateIp): Promise<Ip> {
			return await repository.update(id, input);
		},

		async deleteIp(id: string): Promise<void> {
			await repository.delete(id);
		},

		async getIpsForMedia(mediaId: string): Promise<Ip[]> {
			return await repository.findByMediaId(mediaId);
		},

		async addIpToMedia(mediaId: string, ipId: string): Promise<void> {
			await repository.addMedia(mediaId, ipId);
		},

		async removeIpFromMedia(mediaId: string, ipId: string): Promise<void> {
			await repository.removeMedia(mediaId, ipId);
		},
	};
}

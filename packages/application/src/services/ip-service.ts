import type { Ip, NewIp, UpdateIp } from "@solid-imager/core/domain/ips/schemas";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";

export type IpService = ReturnType<typeof createIpService>;

export function createIpService(repository: IIpRepository) {
	return {
		async list(): Promise<Ip[]> {
			return await repository.findAll();
		},

		async get(id: string): Promise<Ip | null> {
			return await repository.findById(id);
		},

		async create(input: NewIp): Promise<Ip> {
			return await repository.create(input);
		},

		async update(id: string, input: UpdateIp): Promise<Ip> {
			return await repository.update(id, input);
		},

		async delete(id: string): Promise<void> {
			await repository.delete(id);
		},

		async listForMedia(mediaId: string): Promise<Ip[]> {
			return await repository.findByMediaId(mediaId);
		},

		async addToMedia(mediaId: string, ipId: string): Promise<void> {
			await repository.addMedia(mediaId, ipId);
		},

		async removeFromMedia(mediaId: string, ipId: string): Promise<void> {
			await repository.removeMedia(mediaId, ipId);
		},
	};
}

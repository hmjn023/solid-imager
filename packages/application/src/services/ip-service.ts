import type { NewIp, UpdateIp, IIpRepository } from "@solid-imager/core/ips";
import type { IIpService } from "../ports/ip-service";

export function createIpService(repo: IIpRepository): IIpService {
	return {
		getAllIps: () => repo.findAll(),
		createIp: (data: NewIp) => repo.create(data),
		getIpDetails: (id: string) => repo.findById(id),
		updateIp: (id: string, data: UpdateIp) => repo.update(id, data),
		deleteIp: (id: string) => repo.delete(id),
		getIpsForMedia: (mediaId: string) => repo.findByMediaId(mediaId),
		addIpToMedia: (mediaId: string, ipId: string) =>
			repo.addMedia(mediaId, ipId),
		removeIpFromMedia: (mediaId: string, ipId: string) =>
			repo.removeMedia(mediaId, ipId),
	};
}

import type {
	Ip,
	NewIp,
	UpdateIp,
} from "@solid-imager/core/domain/ips/schemas";

export interface IIpService {
	getAllIps(): Promise<Ip[]>;
	createIp(data: NewIp): Promise<Ip>;
	getIpDetails(id: string): Promise<Ip | null>;
	updateIp(id: string, data: UpdateIp): Promise<Ip>;
	deleteIp(id: string): Promise<void>;
	getIpsForMedia(mediaId: string): Promise<Ip[]>;
	addIpToMedia(mediaId: string, ipId: string): Promise<void>;
	removeIpFromMedia(mediaId: string, ipId: string): Promise<void>;
}

import { createIpService } from "@solid-imager/application/services/ip-service";
import type { NewIp } from "@solid-imager/core/domain/ips/schemas";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";

/**
 * IpService - IP (知的財産) 管理機能
 * Feature 12: IP管理機能
 */

const ipService = createIpService(IpRepository);

/**
 * Provides services for managing Intellectual Properties (IPs).
 */
export const IpService = {
	/**
	 * Retrieves all Intellectual Properties (IPs).
	 */
	async getAllIps() {
		return await ipService.getAllIps();
	},

	/**
	 * Creates a new Intellectual Property (IP).
	 */
	async createIp(ipData: { name: string; description?: string }) {
		const newIp: NewIp = {
			name: ipData.name,
			description: ipData.description,
		};
		return await ipService.createIp(newIp);
	},

	/**
	 * Retrieves details of a specific Intellectual Property (IP) by its ID.
	 */
	async getIpDetails(ipId: string) {
		return await ipService.getIpDetails(ipId);
	},

	/**
	 * Updates an existing Intellectual Property (IP).
	 */
	async updateIp(
		ipId: string,
		ipData: { name?: string; description?: string },
	) {
		return await ipService.updateIp(ipId, ipData);
	},

	/**
	 * Deletes an Intellectual Property (IP) by its ID.
	 */
	async deleteIp(ipId: string) {
		return await ipService.deleteIp(ipId);
	},

	/**
	 * Retrieves IPs associated with a specific media.
	 */
	async getIpsForMedia(mediaId: string) {
		return await ipService.getIpsForMedia(mediaId);
	},

	/**
	 * Adds an IP to a media.
	 */
	async addIpToMedia(mediaId: string, ipId: string) {
		return await ipService.addIpToMedia(mediaId, ipId);
	},

	/**
	 * Removes an IP from a media.
	 */
	async removeIpFromMedia(mediaId: string, ipId: string) {
		return await ipService.removeIpFromMedia(mediaId, ipId);
	},
};

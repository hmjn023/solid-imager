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
	async list() {
		return await ipService.list();
	},

	/**
	 * Creates a new Intellectual Property (IP).
	 */
	async create(ipData: { name: string; description?: string }) {
		const newIp: NewIp = {
			name: ipData.name,
			description: ipData.description,
		};
		return await ipService.create(newIp);
	},

	/**
	 * Retrieves details of a specific Intellectual Property (IP) by its ID.
	 */
	async get(ipId: string) {
		return await ipService.get(ipId);
	},

	/**
	 * Updates an existing Intellectual Property (IP).
	 */
	async update(ipId: string, ipData: { name?: string; description?: string }) {
		return await ipService.update(ipId, ipData);
	},

	/**
	 * Deletes an Intellectual Property (IP) by its ID.
	 */
	async delete(ipId: string) {
		return await ipService.delete(ipId);
	},

	/**
	 * Retrieves IPs associated with a specific media.
	 */
	async listForMedia(mediaId: string) {
		return await ipService.listForMedia(mediaId);
	},

	/**
	 * Adds an IP to a media.
	 */
	async addToMedia(mediaId: string, ipId: string) {
		return await ipService.addToMedia(mediaId, ipId);
	},

	/**
	 * Removes an IP from a media.
	 */
	async removeFromMedia(mediaId: string, ipId: string) {
		return await ipService.removeFromMedia(mediaId, ipId);
	},
};

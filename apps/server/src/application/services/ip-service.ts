import type { NewIp } from "@solid-imager/core/domain/ips/schemas";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";

/**
 * IpService - IP (知的財産) 管理機能
 * Feature 12: IP管理機能
 */

/**
 * Provides services for managing Intellectual Properties (IPs).
 */
export const IpService = {
	/**
	 * Retrieves all Intellectual Properties (IPs).
	 */
	async getAllIps() {
		return await IpRepository.findAll();
	},

	/**
	 * Creates a new Intellectual Property (IP).
	 */
	async createIp(ipData: { name: string; description?: string }) {
		const newIp: NewIp = {
			name: ipData.name,
			description: ipData.description,
		};
		return await IpRepository.create(newIp);
	},

	/**
	 * Retrieves details of a specific Intellectual Property (IP) by its ID.
	 */
	async getIpDetails(ipId: string) {
		return await IpRepository.findById(ipId);
	},

	/**
	 * Updates an existing Intellectual Property (IP).
	 */
	async updateIp(ipId: string, ipData: { name?: string; description?: string }) {
		return await IpRepository.update(ipId, ipData);
	},

	/**
	 * Deletes an Intellectual Property (IP) by its ID.
	 */
	async deleteIp(ipId: string) {
		return await IpRepository.delete(ipId);
	},

	/**
	 * Retrieves IPs associated with a specific media.
	 */
	async getIpsForMedia(mediaId: string) {
		return await IpRepository.findByMediaId(mediaId);
	},

	/**
	 * Adds an IP to a media.
	 */
	async addIpToMedia(mediaId: string, ipId: string) {
		return await IpRepository.addMedia(mediaId, ipId);
	},

	/**
	 * Removes an IP from a media.
	 */
	async removeIpFromMedia(mediaId: string, ipId: string) {
		return await IpRepository.removeMedia(mediaId, ipId);
	},
};

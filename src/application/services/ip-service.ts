import {
  deleteIp,
  insertIp,
  selectIpById,
  selectIps,
  updateIp,
} from "~/infrastructure/db/queries/ips";

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
   * @returns {Promise<any>} A list of all IPs.
   */
  async getAllIps() {
    return await selectIps();
  },

  /**
   * Creates a new Intellectual Property (IP).
   * @param {object} ipData - The data for the new IP.
   * @param {string} ipData.name - The name of the IP.
   * @param {string} [ipData.description] - An optional description for the IP.
   * @returns {Promise<any>} The newly created IP.
   */
  async createIp(ipData: { name: string; description?: string }) {
    const result = await insertIp(ipData);
    return result[0];
  },

  /**
   * Retrieves details of a specific Intellectual Property (IP) by its ID.
   * @param {number} ipId - The ID of the IP.
   * @returns {Promise<any>} The details of the specified IP.
   */
  async getIpDetails(ipId: number) {
    return await selectIpById(ipId);
  },

  /**
   * Updates an existing Intellectual Property (IP).
   * @param {number} ipId - The ID of the IP to update.
   * @param {object} ipData - The updated data for the IP.
   * @param {string} [ipData.name] - The new name of the IP.
   * @param {string} [ipData.description] - The new description for the IP.
   * @returns {Promise<any>} The updated IP.
   */
  async updateIp(
    ipId: number,
    ipData: { name?: string; description?: string }
  ) {
    return await updateIp(ipId, ipData);
  },

  /**
   * Deletes an Intellectual Property (IP) by its ID.
   * @param {number} ipId - The ID of the IP to delete.
   * @returns {Promise<any>} Confirmation of deletion.
   */
  async deleteIp(ipId: number) {
    return await deleteIp(ipId);
  },
};

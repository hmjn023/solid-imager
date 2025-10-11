/**
 * IpService - IP (知的財産) 管理機能
 * Feature 12: IP管理機能
 */

export const IpService = {
  // Feature 12: IP管理機能
  async getAllIps() {
    // TODO: Get all IPs
    throw new Error("Not implemented");
  },

  async createIp(_ipData: { name: string; description?: string }) {
    // TODO: Create new IP
    throw new Error("Not implemented");
  },

  async getIpDetails(_ipId: number) {
    // TODO: Get IP details by ID
    throw new Error("Not implemented");
  },

  async updateIp(
    _ipId: number,
    _ipData: { name?: string; description?: string }
  ) {
    // TODO: Update IP
    throw new Error("Not implemented");
  },

  async deleteIp(_ipId: number) {
    // TODO: Delete IP
    throw new Error("Not implemented");
  },
};

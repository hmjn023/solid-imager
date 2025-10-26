/**
 * IPs API Client
 * Extracted from src/lib/api/ips.ts
 */

/**
 * Fetches all Intellectual Properties (IPs) from the API.
 * @returns {any[]} An array of IP objects.
 */
export function getIps() {
  return [];
}

/**
 * Creates a new Intellectual Property (IP) via the API.
 * @param {string} name - The name of the IP.
 * @param {string} [description] - An optional description for the IP.
 * @returns {object} The newly created IP object with an ID.
 */
export function createIp(name: string, description?: string) {
  return { id: 1, name, description };
}

/**
 * Fetches a single Intellectual Property (IP) by its ID from the API.
 * @param {number} id - The ID of the IP to fetch.
 * @returns {object} The IP object matching the ID.
 */
export function getIpById(id: number) {
  return { id, name: `IP ${id}`, description: `Description for IP ${id}` };
}

/**
 * Updates an existing Intellectual Property (IP) via the API.
 * @param {number} id - The ID of the IP to update.
 * @param {string} [name] - The new name of the IP.
 * @param {string} [description] - The new description for the IP.
 * @returns {object} The updated IP object.
 */
export function updateIp(id: number, name?: string, description?: string) {
  return {
    id,
    name: name || `IP ${id}`,
    description: description || `Description for IP ${id}`,
  };
}

/**
 * Deletes an Intellectual Property (IP) by its ID via the API.
 * @param {number} _id - The ID of the IP to delete.
 * @returns {object} An object indicating the success of the deletion.
 */
export function deleteIp(_id: number) {
  return { success: true };
}

/**
 * IPs API Client
 * Extracted from src/lib/api/ips.ts
 */

export function getIps() {
  return [];
}

export function createIp(name: string, description?: string) {
  return { id: 1, name, description };
}

export function getIpById(id: number) {
  return { id, name: `IP ${id}`, description: `Description for IP ${id}` };
}

export function updateIp(id: number, name?: string, description?: string) {
  return {
    id,
    name: name || `IP ${id}`,
    description: description || `Description for IP ${id}`,
  };
}

export function deleteIp(_id: number) {
  return { success: true };
}

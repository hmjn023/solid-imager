/**
 * IPs API Client
 *
 * NOTE: Migrated to use oRPC ✅
 */

import { orpc } from "~/infrastructure/api-clients/orpc-client";

export function fetchAllIps() {
	return orpc.ips.list();
}

export function createIp(data: { name: string; description?: string }) {
	return orpc.ips.create(data);
}

export function updateIp(id: string, data: { name?: string; description?: string }) {
	return orpc.ips.update({ id, data });
}

export function deleteIp(id: string) {
	return orpc.ips.delete({ id });
}

export function fetchIpsForMedia(_sourceId: string, mediaId: string) {
	return orpc.ips.listForMedia({ mediaId });
}

export function addIpToMedia(_sourceId: string, mediaId: string, ipId: string) {
	return orpc.ips.addToMedia({ mediaId, ipId });
}

export function removeIpFromMedia(_sourceId: string, mediaId: string, ipId: string) {
	return orpc.ips.removeFromMedia({ mediaId, ipId });
}

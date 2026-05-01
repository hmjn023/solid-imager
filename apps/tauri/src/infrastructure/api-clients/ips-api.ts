import { orpc } from "./orpc-client";

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

export function addIpToMedia(_sourceId: string, mediaId: string, ipId: string) {
	return orpc.ips.addToMedia({ mediaId, ipId });
}

export function removeIpFromMedia(_sourceId: string, mediaId: string, ipId: string) {
	return orpc.ips.removeFromMedia({ mediaId, ipId });
}

export { fetchAllIps } from "~/api/entities-api";

import { client } from "~/orpc-client";

export function createIp(data: { name: string; description?: string }) {
	return client.ips.create(data);
}

export function updateIp(id: string, data: { name?: string; description?: string }) {
	return client.ips.update({ id, data });
}

export async function deleteIp(id: string) {
	await client.ips.delete({ id });
}

export async function addIpToMedia(mediaId: string, ipId: string) {
	await client.ips.addToMedia({ mediaId, ipId });
}

export async function removeIpFromMedia(mediaId: string, ipId: string) {
	await client.ips.removeFromMedia({ mediaId, ipId });
}

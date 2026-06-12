import type { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import type { z } from "zod";
import { client } from "~/orpc-client";

export function fetchMediaSources() {
	return client.sources.list();
}

export function fetchMediaSource(id: string) {
	return client.sources.get({ id });
}

export function createMediaSource(
	data: z.infer<typeof mediaSourceInfoSchema>,
) {
	return client.sources.create(data);
}

export function updateMediaSource(
	id: string,
	data: Partial<z.infer<typeof mediaSourceInfoSchema>>,
) {
	return client.sources.update({ id, data });
}

export async function deleteMediaSource(id: string): Promise<void> {
	await client.sources.delete({ id });
}

export function syncMediaSources(ids: string[]) {
	return client.sources.sync({ ids });
}

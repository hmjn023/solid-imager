import type {
	mediaSourceInfoSchema,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import type { z } from "zod";
import { client } from "~/orpc-client";

export function fetchMediaSources(): Promise<SafeMediaSource[]> {
	return client.sources.list() as unknown as Promise<SafeMediaSource[]>;
}

export function fetchMediaSource(id: string): Promise<SafeMediaSource> {
	return client.sources.get({ id }) as unknown as Promise<SafeMediaSource>;
}

export function createMediaSource(
	data: z.infer<typeof mediaSourceInfoSchema>,
): Promise<SafeMediaSource> {
	return client.sources.create(data) as unknown as Promise<SafeMediaSource>;
}

export function updateMediaSource(
	id: string,
	data: Partial<z.infer<typeof mediaSourceInfoSchema>>,
): Promise<SafeMediaSource> {
	return client.sources.update({
		id,
		data,
	}) as unknown as Promise<SafeMediaSource>;
}

export async function deleteMediaSource(id: string): Promise<void> {
	await client.sources.delete({ id });
}

export function syncMediaSources(ids: string[]) {
	return client.sources.sync({ ids });
}

import type { MediaSourceInfo } from "@solid-imager/core/domain/sources/schemas";
import { orpc } from "./orpc-client";

export function fetchMediaSources() {
	return orpc.sources.list();
}

export function fetchMediaSource(id: string) {
	return orpc.sources.get({ id });
}

export function createMediaSource(data: MediaSourceInfo) {
	return orpc.sources.create(data);
}

export function updateMediaSource(id: string, data: Partial<MediaSourceInfo>) {
	return orpc.sources.update({ id, data });
}

export async function deleteMediaSource(id: string): Promise<void> {
	await orpc.sources.delete({ id });
}

export function syncMediaSources(ids: string[]) {
	return orpc.sources.sync({ ids });
}

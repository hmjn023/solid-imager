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

export async function fetchSourceDump(
	id: string,
	mode: "json" | "zip" = "json",
): Promise<Blob> {
	if (mode === "zip") {
		const result = await orpc.sources.dumpZip({ id });
		return new Blob([new Uint8Array(result.data)], {
			type: result.mimeType,
		});
	}
	const source = await fetchMediaSource(id);
	const result = await orpc.media.search({
		sourceId: id,
		params: {
			limit: 10_000,
			offset: 0,
			order: "desc",
		},
	});
	const data = {
		source,
		media: result.media,
		exportedAt: new Date().toISOString(),
	};
	return new Blob([JSON.stringify(data, null, 2)], {
		type: "application/json",
	});
}

export async function restoreSource(id: string, data: unknown) {
	const payload = data as
		| {
				media?: unknown[];
		  }
		| unknown[];
	const items = Array.isArray(payload)
		? payload
		: Array.isArray(payload.media)
			? payload.media
			: [];
	return orpc.sources.restore({ id, data: items });
}

export async function importSourceZip(id: string, file: File) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	return orpc.sources.importZip({ id, bytes: Array.from(bytes) });
}

export {
	createMediaSource,
	deleteMediaSource,
	fetchMediaSource,
	fetchMediaSources,
	syncMediaSources,
	updateMediaSource,
} from "~/api/sources-api";

import { downloadCompletedJobArtifact } from "@solid-imager/client";
import { client } from "~/orpc-client";

export async function fetchSourceDump(
	id: string,
	mode: "json" | "zip" = "json",
	opts?: { includeImages?: boolean },
): Promise<Blob> {
	const includeImages = opts?.includeImages ?? mode === "zip";
	const job = await client.sources.enqueueExport({ id, mode, includeImages });
	return downloadCompletedJobArtifact(client.jobs, job.id);
}

export async function restoreSource(
	sourceId: string,
	data: unknown,
	_opts?: {
		signal?: AbortSignal;
		onProgress?: (done: number, total: number) => void;
	},
) {
	return client.sources.restore({
		id: sourceId,
		data: data as unknown[],
	});
}

export async function importSourceZip(id: string, file: File) {
	return client.sources.enqueueImport({ id, mode: "zip", file });
}

export async function importSourceNdjson(id: string, file: File) {
	return client.sources.enqueueImport({ id, mode: "json", file });
}
export function parseRestoreFile(file: File): Promise<unknown[]> {
	return file.text().then((text) => JSON.parse(text));
}

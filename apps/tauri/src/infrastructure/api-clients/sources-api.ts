export {
	createMediaSource,
	deleteMediaSource,
	fetchMediaSource,
	fetchMediaSources,
	syncMediaSources,
	updateMediaSource,
} from "~/api/sources-api";

export function enqueueSourceExport(
	id: string,
	mode: "ndjson" | "tar",
	includeImages: boolean,
) {
	return client.sources.enqueueExport({ id, mode, includeImages });
}

export function enqueueSourceImport(
	id: string,
	mode: "ndjson" | "tar",
	file: File,
) {
	return client.sources.enqueueImport({ id, mode, file });
}

import { downloadCompletedJobArtifact } from "@solid-imager/client";
import { client } from "~/orpc-client";

export async function fetchSourceDump(
	id: string,
	mode: "ndjson" | "tar" = "ndjson",
	opts?: { includeImages?: boolean },
): Promise<Blob> {
	const includeImages = opts?.includeImages ?? mode === "tar";
	const job = await client.sources.enqueueExport({ id, mode, includeImages });
	return downloadCompletedJobArtifact(client.jobs, job.id);
}

export async function importSourceTar(id: string, file: File) {
	return client.sources.enqueueImport({ id, mode: "tar", file });
}

export async function importSourceNdjson(id: string, file: File) {
	return client.sources.enqueueImport({ id, mode: "ndjson", file });
}

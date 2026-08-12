export {
	createMediaSource,
	deleteMediaSource,
	fetchMediaSource,
	fetchMediaSources,
	syncMediaSources,
	updateMediaSource,
} from "~/api/sources-api";

import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import { client } from "~/orpc-client";

async function waitForExport(jobId: string): Promise<JobDto> {
	for (;;) {
		const job = await client.jobs.get({ id: jobId });
		if (job.status === "completed") {
			return job;
		}
		if (job.status === "failed" || job.status === "cancelled") {
			throw new Error(job.error ?? `Export job ${job.status}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
}

export async function fetchSourceDump(
	id: string,
	mode: "json" | "zip" | "lancedb" = "json",
	opts?: { includeImages?: boolean },
): Promise<Blob> {
	const includeImages = opts?.includeImages ?? false;
	const job = await client.sources.enqueueExport({ id, mode, includeImages });
	const completedJob = await waitForExport(job.id);
	if (!completedJob.artifact) {
		throw new Error("Export completed without an artifact");
	}
	const stream = await client.jobs.downloadArtifact({ id: completedJob.id });
	return new Response(stream).blob();
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
	return client.sources.importZip({ id, file });
}

export async function importSourceNdjson(id: string, file: File) {
	return client.sources.importNdjson({
		id,
		file,
	});
}

export async function importSourceLanceDB(id: string, file: File) {
	return client.sources.importLanceDB({ id, file });
}

export function parseRestoreFile(file: File): Promise<unknown[]> {
	return file.text().then((text) => JSON.parse(text));
}

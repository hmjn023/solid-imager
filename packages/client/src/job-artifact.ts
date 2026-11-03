/** Job status and artifact metadata needed while waiting for an export. */
export type ExportJob = {
	id: string;
	status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
	error: string | null;
	artifact: { contentType: string } | null;
};

/** Minimal job API required to wait for and download an export artifact. */
export type JobArtifactClient = {
	get: (
		input: { id: string },
		options?: { signal?: AbortSignal },
	) => Promise<ExportJob>;
	downloadArtifact: (
		input: { id: string },
		options?: { signal?: AbortSignal },
	) => Promise<Blob | ReadableStream<unknown>>;
};

const DEFAULT_EXPORT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Poll an export job every 500 ms and download its artifact as a Blob.
 *
 * @param jobs - Job lookup and artifact download operations.
 * @param jobId - ID of the export job to wait for.
 * @param options - Cancellation signal and total timeout in milliseconds (default five minutes).
 * @returns The downloaded artifact, with the job's content type.
 * @throws If the job fails or is cancelled, completes without an artifact, or waiting is cancelled or times out. Transport errors also propagate.
 */
export async function downloadCompletedJobArtifact(
	jobs: JobArtifactClient,
	jobId: string,
	options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Blob> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_EXPORT_TIMEOUT_MS;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	const signal = options.signal
		? AbortSignal.any([options.signal, controller.signal])
		: controller.signal;

	try {
		for (;;) {
			if (signal.aborted) {
				throw new Error("Export download was cancelled or timed out");
			}
			const job = await jobs.get({ id: jobId }, { signal });
			if (job.status === "completed") {
				if (!job.artifact) {
					throw new Error("Export completed without an artifact");
				}
				const stream = await jobs.downloadArtifact({ id: jobId }, { signal });
				return new Response(stream as ReadableStream<Uint8Array>, {
					headers: { "content-type": job.artifact.contentType },
				}).blob();
			}
			if (job.status === "failed" || job.status === "cancelled") {
				throw new Error(job.error ?? `Export job ${job.status}`);
			}
			await new Promise<void>((resolve, reject) => {
				const onAbort = () => {
					clearTimeout(pollDelay);
					reject(new Error("Export download was cancelled or timed out"));
				};
				const pollDelay = setTimeout(() => {
					signal.removeEventListener("abort", onAbort);
					resolve();
				}, 500);
				signal.addEventListener("abort", onAbort, { once: true });
			});
		}
	} finally {
		clearTimeout(timeout);
	}
}

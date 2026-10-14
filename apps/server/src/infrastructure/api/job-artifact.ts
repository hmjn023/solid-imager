import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import { JobRepository } from "~/infrastructure/repositories/job-repository";
import { SourceRunRepository } from "~/infrastructure/repositories/source-run-repository";
import { sourceRunService } from "~/infrastructure/services/source-run-service";
import { isJobTransferPath } from "~/infrastructure/services/job-transfer-storage";
import { nodeStreamToWebReadable } from "~/infrastructure/utils/stream-utils";

export type ResolvedJobArtifact = {
	job: Pick<Job, "id">;
	path: string;
	fileName: string;
	contentType: string;
	size: number;
	stream: ReadableStream<Uint8Array>;
};

export async function resolveJobArtifact(
	jobId: string,
): Promise<ResolvedJobArtifact | null> {
	await sourceRunService.initialize();
	const run = await SourceRunRepository.findById(jobId);
	if (run) {
		const artifact = run.artifact;
		if (
			run.status !== "completed" ||
			!artifact ||
			artifact.expiresAt <= new Date() ||
			!isJobTransferPath(run.id, artifact.path)
		)
			return null;
		const stat = await fs.stat(artifact.path).catch(() => null);
		if (!stat?.isFile()) return null;
		return {
			job: { id: run.id },
			path: artifact.path,
			fileName: artifact.fileName,
			contentType: artifact.contentType,
			size: stat.size,
			stream: nodeStreamToWebReadable(createReadStream(artifact.path)),
		};
	}
	const job = await JobRepository.findById(jobId);
	if (
		job?.status !== "completed" ||
		!job.artifactPath ||
		!job.artifactFileName ||
		!job.artifactContentType ||
		!isJobTransferPath(job.id, job.artifactPath)
	) {
		return null;
	}

	if (job.artifactExpiresAt && job.artifactExpiresAt <= new Date()) {
		return null;
	}

	let stat: Awaited<ReturnType<typeof fs.stat>>;
	try {
		stat = await fs.stat(job.artifactPath);
	} catch {
		return null;
	}
	if (!stat.isFile()) {
		return null;
	}

	return {
		job,
		path: job.artifactPath,
		fileName: job.artifactFileName,
		contentType: job.artifactContentType,
		size: stat.size,
		stream: nodeStreamToWebReadable(createReadStream(job.artifactPath)),
	};
}

function encodeContentDispositionFilename(fileName: string): string {
	return encodeURIComponent(fileName).replace(
		/[!'()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

export function createJobArtifactHeaders(
	artifact: Pick<ResolvedJobArtifact, "fileName" | "contentType" | "size">,
): HeadersInit {
	const fallbackFileName =
		artifact.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_") ||
		"job-artifact";
	return {
		"Cache-Control": "no-store",
		"Content-Disposition": `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodeContentDispositionFilename(artifact.fileName)}`,
		"Content-Length": String(artifact.size),
		"Content-Type": artifact.contentType,
	};
}

import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { webReadableToNodeStream } from "~/infrastructure/utils/stream-utils";

const configuredTransferDirectory = process.env.SOLID_IMAGER_JOB_TRANSFER_DIR;
const isolatedRuntimeDirectory =
	process.env.E2E_RUNTIME_DIR ?? process.env.DEV_STARTUP_RUNTIME_DIR;
const JobTransferDirectory = path.resolve(
	configuredTransferDirectory ??
		(isolatedRuntimeDirectory
			? path.join(isolatedRuntimeDirectory, ".cache", "job-transfers")
			: path.join(process.cwd(), ".cache", "job-transfers")),
);
const JobArtifactTtlMs = 24 * 60 * 60 * 1000;

export type JobTransferMode = "ndjson" | "tar";

export type JobArtifact = {
	path: string;
	fileName: string;
	contentType: string;
	size: number;
	expiresAt: Date;
};

export function getJobTransferRoot(): string {
	return JobTransferDirectory;
}

function getModeExtension(mode: JobTransferMode): string {
	return mode;
}

export function getInputPath(jobId: string, mode: JobTransferMode): string {
	return path.join(
		JobTransferDirectory,
		"inputs",
		`${jobId}.${getModeExtension(mode)}`,
	);
}

export function getInputPartialPath(
	jobId: string,
	mode: JobTransferMode,
): string {
	return `${getInputPath(jobId, mode)}.partial`;
}

export function getArtifactPath(jobId: string, mode: JobTransferMode): string {
	return path.join(
		JobTransferDirectory,
		"artifacts",
		`${jobId}.${getModeExtension(mode)}`,
	);
}

export function getArtifactPartialPath(
	jobId: string,
	mode: JobTransferMode,
): string {
	return `${getArtifactPath(jobId, mode)}.partial`;
}

export function isJobTransferPath(jobId: string, targetPath: string): boolean {
	const resolvedTarget = path.resolve(targetPath);
	const resolvedRoot = path.resolve(JobTransferDirectory);
	return (
		resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`) &&
		path.basename(resolvedTarget).startsWith(jobId)
	);
}

export function getArtifactMetadata(
	jobId: string,
	mediaSourceId: string,
	mode: JobTransferMode,
): Omit<JobArtifact, "size"> {
	if (mode === "ndjson") {
		return {
			path: getArtifactPath(jobId, mode),
			fileName: `source-${mediaSourceId}-dump.ndjson`,
			contentType: "application/x-ndjson",
			expiresAt: new Date(Date.now() + JobArtifactTtlMs),
		};
	}

	return {
		path: getArtifactPath(jobId, mode),
		fileName: `source-${mediaSourceId}-dump.tar`,
		contentType: "application/x-tar",
		expiresAt: new Date(Date.now() + JobArtifactTtlMs),
	};
}

export async function persistJobInput(
	jobId: string,
	mode: JobTransferMode,
	file: File,
): Promise<string> {
	const inputPath = getInputPath(jobId, mode);
	const partialPath = getInputPartialPath(jobId, mode);
	await fs.mkdir(path.dirname(inputPath), { recursive: true });
	await removeJobTransferFile(inputPath);
	await removeJobTransferFile(partialPath);
	try {
		await pipeline(
			webReadableToNodeStream(file.stream()),
			createWriteStream(partialPath),
		);
		await fs.rename(partialPath, inputPath);
		return inputPath;
	} finally {
		await removeJobTransferFile(partialPath);
	}
}

export async function removeJobTransferFile(targetPath: string): Promise<void> {
	if (!targetPath.startsWith(`${JobTransferDirectory}${path.sep}`)) {
		return;
	}
	await fs.rm(targetPath, { force: true }).catch(() => {});
}

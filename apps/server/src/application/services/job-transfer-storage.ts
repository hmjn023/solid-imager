import type { Dirent } from "node:fs";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { webReadableToNodeStream } from "~/infrastructure/utils/stream-utils";

const JobTransferDirectory = path.resolve(
	process.cwd(),
	".cache",
	"job-transfers",
);
const JobArtifactTtlMs = 24 * 60 * 60 * 1000;

export type JobTransferMode = "json" | "zip" | "lancedb";

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
	return mode === "json" ? "ndjson" : "tar";
}

export function getInputPath(jobId: string, mode: JobTransferMode): string {
	return path.join(
		JobTransferDirectory,
		"inputs",
		`${jobId}.${getModeExtension(mode)}`,
	);
}

export function getArtifactPath(jobId: string, mode: JobTransferMode): string {
	return path.join(
		JobTransferDirectory,
		"artifacts",
		`${jobId}.${getModeExtension(mode)}`,
	);
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
	if (mode === "json") {
		return {
			path: getArtifactPath(jobId, mode),
			fileName: `source-${mediaSourceId}-dump.ndjson`,
			contentType: "application/x-ndjson",
			expiresAt: new Date(Date.now() + JobArtifactTtlMs),
		};
	}

	return {
		path: getArtifactPath(jobId, mode),
		fileName:
			mode === "lancedb"
				? `source-${mediaSourceId}-dump-lancedb.tar`
				: `source-${mediaSourceId}-dump.tar`,
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
	await fs.mkdir(path.dirname(inputPath), { recursive: true });
	await pipeline(
		webReadableToNodeStream(file.stream()),
		createWriteStream(inputPath),
	);
	return inputPath;
}

export async function removeJobTransferFile(targetPath: string): Promise<void> {
	if (!targetPath.startsWith(`${JobTransferDirectory}${path.sep}`)) {
		return;
	}
	await fs.rm(targetPath, { force: true }).catch(() => {});
}

function isNodeErrorCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === code
	);
}

export async function cleanupExpiredJobTransferFiles(
	now = Date.now(),
): Promise<void> {
	const expirationTime = now - JobArtifactTtlMs;
	for (const directoryName of ["inputs", "artifacts"] as const) {
		const directoryPath = path.join(JobTransferDirectory, directoryName);
		let entries: Dirent[];
		try {
			entries = await fs.readdir(directoryPath, { withFileTypes: true });
		} catch (error) {
			if (isNodeErrorCode(error, "ENOENT")) {
				continue;
			}
			throw error;
		}

		for (const entry of entries) {
			if (!entry.isFile()) {
				continue;
			}
			const targetPath = path.join(directoryPath, entry.name);
			const stat = await fs.stat(targetPath);
			if (stat.mtimeMs <= expirationTime) {
				await removeJobTransferFile(targetPath);
			}
		}
	}
}

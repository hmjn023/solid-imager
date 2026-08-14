import type { Dirent } from "node:fs";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
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
const JobTransferStaleFileTtlMs = 60 * 60 * 1000;

export type JobTransferMode = "json" | "zip";

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

type TransferFileKind = "inputs" | "artifacts";

type JobLookup = (jobId: string) => Promise<Job | null>;

type JobTransferCleanupResult = {
	removedFiles: number;
	removedBytes: number;
};

const TransferFileNamePattern =
	/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(?:ndjson|tar)$/i;
const TarStagingDirectoryNamePattern =
	/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-export-/i;

function readTransferJobId(fileName: string): string | null {
	return TransferFileNamePattern.exec(fileName)?.[1] ?? null;
}

function readTarStagingJobId(directoryName: string): string | null {
	return TarStagingDirectoryNamePattern.exec(directoryName)?.[1] ?? null;
}

function readRestoreInputPath(payload: unknown): string | null {
	if (
		typeof payload !== "object" ||
		payload === null ||
		Array.isArray(payload)
	) {
		return null;
	}
	const inputPath = (payload as { inputPath?: unknown }).inputPath;
	return typeof inputPath === "string" ? inputPath : null;
}

function isExpectedTransferFile(
	kind: TransferFileKind,
	targetPath: string,
	job: Job | null,
): boolean {
	if (!job) {
		return false;
	}

	if (kind === "artifacts") {
		return job.status === "completed" && job.artifactPath === targetPath;
	}

	return (
		(job.status === "pending" || job.status === "in_progress") &&
		readRestoreInputPath(job.payload) === targetPath
	);
}

async function latestModificationTime(targetPath: string): Promise<number> {
	let stat: Awaited<ReturnType<typeof fs.stat>>;
	try {
		stat = await fs.stat(targetPath);
	} catch {
		return 0;
	}

	if (!stat.isDirectory()) {
		return stat.mtimeMs;
	}

	let latest = stat.mtimeMs;
	let entries: Dirent[];
	try {
		entries = await fs.readdir(targetPath, { withFileTypes: true });
	} catch {
		return latest;
	}

	for (const entry of entries) {
		latest = Math.max(
			latest,
			await latestModificationTime(path.join(targetPath, entry.name)),
		);
	}
	return latest;
}

async function cleanupOrphanedTarStaging(
	expirationTime: number,
	findJob: JobLookup,
): Promise<JobTransferCleanupResult> {
	const stagingDirectory = path.join(JobTransferDirectory, "..", "tar-staging");
	let entries: Dirent[];
	try {
		entries = await fs.readdir(stagingDirectory, { withFileTypes: true });
	} catch (error) {
		if (isNodeErrorCode(error, "ENOENT")) {
			return { removedFiles: 0, removedBytes: 0 };
		}
		throw error;
	}

	let removedFiles = 0;
	let removedBytes = 0;
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const targetPath = path.join(stagingDirectory, entry.name);
		const jobId = readTarStagingJobId(entry.name);
		if (jobId) {
			const job = await findJob(jobId);
			if (job?.status === "pending" || job?.status === "in_progress") {
				continue;
			}
		}
		if ((await latestModificationTime(targetPath)) > expirationTime) {
			continue;
		}
		const stat = await fs.stat(targetPath).catch(() => null);
		await fs.rm(targetPath, { recursive: true, force: true });
		removedFiles++;
		removedBytes += stat?.isDirectory() ? 0 : (stat?.size ?? 0);
	}

	return { removedFiles, removedBytes };
}

/**
 * Removes transfer files left by failed, cancelled, stale, or deleted jobs.
 * Completed artifacts and restore inputs still referenced by pending jobs are
 * retained; age-based expiry remains handled by cleanupExpiredJobTransferFiles.
 */
export async function cleanupOrphanedJobTransferFiles(
	findJob: JobLookup,
	now = Date.now(),
): Promise<JobTransferCleanupResult> {
	const expirationTime = now - JobTransferStaleFileTtlMs;
	const jobCache = new Map<string, Job | null>();
	let removedFiles = 0;
	let removedBytes = 0;

	for (const kind of ["inputs", "artifacts"] as const) {
		const directoryPath = path.join(JobTransferDirectory, kind);
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
			const stat = await fs.stat(targetPath).catch(() => null);
			if (!stat || stat.mtimeMs > expirationTime) {
				continue;
			}

			const isPartial = entry.name.endsWith(".partial");
			const jobId = readTransferJobId(
				isPartial ? entry.name.slice(0, -".partial".length) : entry.name,
			);
			let shouldRemove = isPartial;
			if (!isPartial && jobId) {
				if (!jobCache.has(jobId)) {
					jobCache.set(jobId, await findJob(jobId));
				}
				const job = jobCache.get(jobId) ?? null;
				// An unknown job may belong to another isolated database/runtime.
				// Keep it for age-based expiry instead of deleting user data.
				shouldRemove =
					job !== null && !isExpectedTransferFile(kind, targetPath, job);
			}

			if (!shouldRemove) {
				continue;
			}
			await removeJobTransferFile(targetPath);
			removedFiles++;
			removedBytes += stat.size;
		}
	}

	const stagingCleanup = await cleanupOrphanedTarStaging(
		expirationTime,
		findJob,
	);
	return {
		removedFiles: removedFiles + stagingCleanup.removedFiles,
		removedBytes: removedBytes + stagingCleanup.removedBytes,
	};
}

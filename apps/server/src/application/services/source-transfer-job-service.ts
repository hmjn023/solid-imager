import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import {
	sourceExportJobPayloadSchema,
	sourceRestoreJobPayloadSchema,
} from "@solid-imager/core/domain/jobs/schemas";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import { services } from "~/application/registry";
import { BackupService } from "~/application/services/backup-service";
import {
	getArtifactMetadata,
	getArtifactPartialPath,
	isJobTransferPath,
	removeJobTransferFile,
} from "~/application/services/job-transfer-storage";
import {
	asDumpStream,
	webReadableToNodeStream,
} from "~/infrastructure/utils/stream-utils";

export async function processSourceExportJob(job: Job): Promise<void> {
	if (!job.mediaSourceId) {
		throw new Error(`Job ${job.id} missing mediaSourceId`);
	}

	const payload = sourceExportJobPayloadSchema.parse(job.payload);
	const dump = await BackupService.createDump(job.mediaSourceId, payload.mode, {
		includeImages: payload.includeImages,
	});
	const artifact = getArtifactMetadata(job.id, job.mediaSourceId, payload.mode);
	const partialPath = getArtifactPartialPath(job.id, payload.mode);
	let artifactCommitted = false;

	await fs.mkdir(path.dirname(artifact.path), { recursive: true });
	await removeJobTransferFile(artifact.path);
	await removeJobTransferFile(partialPath);
	try {
		await pipeline(
			webReadableToNodeStream(asDumpStream(dump)),
			createWriteStream(partialPath),
		);
		await fs.rename(partialPath, artifact.path);
		artifactCommitted = true;

		const stat = await fs.stat(artifact.path);
		await services.getJobRepository().setArtifact(job.id, {
			...artifact,
			size: stat.size,
		});
	} catch (error) {
		if (artifactCommitted) {
			await removeJobTransferFile(artifact.path);
		}
		throw error;
	} finally {
		await removeJobTransferFile(partialPath);
	}
}

export async function processSourceRestoreJob(job: Job): Promise<unknown> {
	if (!job.mediaSourceId) {
		throw new Error(`Job ${job.id} missing mediaSourceId`);
	}

	const payload = sourceRestoreJobPayloadSchema.parse(job.payload);
	if (!isJobTransferPath(job.id, payload.inputPath)) {
		throw new Error("Invalid source restore input path");
	}

	let completed = false;
	try {
		if (payload.mode === "json") {
			const result = await BackupService.importSourceNdjson(
				job.mediaSourceId,
				payload.inputPath,
			);
			completed = true;
			return result;
		}
		const result = await BackupService.importSourceTar(
			job.mediaSourceId,
			payload.inputPath,
		);
		completed = true;
		return result;
	} finally {
		if (completed) {
			await removeJobTransferFile(payload.inputPath);
		}
	}
}

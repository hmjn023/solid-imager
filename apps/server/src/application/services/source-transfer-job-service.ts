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

	await fs.mkdir(path.dirname(artifact.path), { recursive: true });
	await pipeline(
		webReadableToNodeStream(asDumpStream(dump)),
		createWriteStream(artifact.path),
	);
	const stat = await fs.stat(artifact.path);
	await services.getJobRepository().setArtifact(job.id, {
		...artifact,
		size: stat.size,
	});
}

export async function processSourceRestoreJob(job: Job): Promise<unknown> {
	if (!job.mediaSourceId) {
		throw new Error(`Job ${job.id} missing mediaSourceId`);
	}

	const payload = sourceRestoreJobPayloadSchema.parse(job.payload);
	if (!isJobTransferPath(job.id, payload.inputPath)) {
		throw new Error("Invalid source restore input path");
	}

	try {
		if (payload.mode === "json") {
			return await BackupService.importSourceNdjson(
				job.mediaSourceId,
				payload.inputPath,
			);
		}
		if (payload.mode === "lancedb") {
			return await BackupService.importLanceDB(
				job.mediaSourceId,
				payload.inputPath,
			);
		}
		return await BackupService.importSourceTar(
			job.mediaSourceId,
			payload.inputPath,
		);
	} finally {
		await removeJobTransferFile(payload.inputPath);
	}
}

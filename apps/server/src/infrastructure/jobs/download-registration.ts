import fs from "node:fs/promises";
import path from "node:path";
import {
	downloadRegistrationCheckpointSchema,
	type DownloadRegistrationEntry,
} from "@solid-imager/core/domain/jobs/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import type {
	IJobRepository,
	Job,
} from "@solid-imager/core/domain/repositories/job-repository";
import { isRecord } from "@solid-imager/core/utils/type-guards";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

/** A hidden staging area prevents watchers from registering incomplete downloads. */
export class DownloadRegistration {
	readonly stagingDirectory: string;
	constructor(
		private readonly job: Job,
		private readonly sourceId: string,
		private readonly sourcePath: string,
		private readonly jobRepo: IJobRepository,
		private readonly register: (
			entry: DownloadRegistrationEntry,
			tx: Transaction,
		) => Promise<Media>,
	) {
		if (!/^[a-zA-Z0-9-]+$/.test(job.id))
			throw new Error("Invalid download job ID");
		this.stagingDirectory = path.join(
			sourcePath,
			".solid-imager-downloads",
			job.id,
			String(job.attemptCount ?? 0),
		);
	}
	async prepare() {
		await fs.mkdir(this.stagingDirectory, { recursive: true });
	}
	async resume(): Promise<boolean> {
		if (
			!isRecord(this.job.payload) ||
			this.job.payload.downloadRegistration === undefined
		)
			return false;
		const checkpoint = downloadRegistrationCheckpointSchema.parse(
			this.job.payload.downloadRegistration,
		);
		if (
			checkpoint.mediaSourceId !== this.sourceId ||
			path.resolve(checkpoint.sourcePath) !== path.resolve(this.sourcePath)
		)
			throw new Error("Download registration source changed");
		const jobDirectory = path.join(
			this.sourcePath,
			".solid-imager-downloads",
			this.job.id,
		);
		this.containedPath(
			jobDirectory,
			path.relative(jobDirectory, checkpoint.stagingDirectory),
		);
		for (const entry of checkpoint.entries) {
			this.containedPath(
				checkpoint.stagingDirectory,
				path.relative(checkpoint.stagingDirectory, entry.stagedPath),
			);
			this.publicationPath(entry.filePath);
		}
		await this.finish(checkpoint);
		return true;
	}
	async complete(entries: DownloadRegistrationEntry[]) {
		for (const entry of entries) {
			this.containedPath(
				this.stagingDirectory,
				path.relative(this.stagingDirectory, entry.stagedPath),
			);
			this.publicationPath(entry.filePath);
		}
		const checkpoint = downloadRegistrationCheckpointSchema.parse({
			version: 1,
			mediaSourceId: this.sourceId,
			sourcePath: this.sourcePath,
			stagingDirectory: this.stagingDirectory,
			entries,
		});
		// Persist paths and source URLs before any completed file becomes visible.
		await this.jobRepo.withActiveAttempt(
			this.job.id,
			this.job.attemptCount ?? 0,
			(tx) => this.save(checkpoint, tx),
		);
		await this.finish(checkpoint);
	}
	private containedPath(base: string, relative: string) {
		if (path.isAbsolute(relative))
			throw new Error("Invalid download registration path");
		const fullPath = path.resolve(base, relative);
		const checked = path.relative(path.resolve(base), fullPath);
		if (!checked || checked.startsWith("..") || path.isAbsolute(checked))
			throw new Error("Invalid download registration path");
		return fullPath;
	}
	private publicationPath(relative: string) {
		const target = this.containedPath(this.sourcePath, relative);
		if (
			path.relative(this.sourcePath, target).split(path.sep)[0] ===
			".solid-imager-downloads"
		)
			throw new Error("Invalid download publication path");
		return target;
	}
	private async save(
		checkpoint: ReturnType<typeof downloadRegistrationCheckpointSchema.parse>,
		tx: Transaction,
	) {
		if (!isRecord(this.job.payload))
			throw new Error("Invalid download payload");
		await this.jobRepo.update(
			this.job.id,
			{ payload: { ...this.job.payload, downloadRegistration: checkpoint } },
			tx,
		);
	}
	private async finish(
		checkpoint: ReturnType<typeof downloadRegistrationCheckpointSchema.parse>,
	) {
		for (const entry of checkpoint.entries) {
			const media = await this.jobRepo.withActiveAttempt(
				this.job.id,
				this.job.attemptCount ?? 0,
				async (tx) => {
					let target = this.publicationPath(entry.filePath);
					if (!entry.published) {
						const staged = await fs.stat(entry.stagedPath);
						if (
							staged.size !== entry.fileSize ||
							staged.mtime.getTime() !== entry.modifiedAt.getTime()
						)
							throw new Error("Completed download changed");
						const original = entry.filePath;
						let collision = 0;
						for (;;) {
							try {
								// link is atomic and cannot overwrite an unrelated file.
								await fs.link(entry.stagedPath, target);
								break;
							} catch (error) {
								if (!isRecord(error) || error.code !== "EEXIST") throw error;
								const existing = await fs.lstat(target);
								if (existing.dev === staged.dev && existing.ino === staged.ino)
									break;
								const extension = path.extname(original);
								entry.filePath = `${original.slice(0, original.length - extension.length)}_(${++collision})${extension}`;
								target = this.publicationPath(entry.filePath);
							}
						}
						entry.published = true;
					} else {
						const published = await fs.stat(target);
						if (
							published.size !== entry.fileSize ||
							published.mtime.getTime() !== entry.modifiedAt.getTime()
						)
							throw new Error("Published download changed");
					}
					const registered = await this.register(entry, tx);
					// URLs, all required requests and this checkpoint commit together.
					await this.save(checkpoint, tx);
					return registered;
				},
			);
			try {
				RealtimeEventBus.publishSource(this.sourceId, "media-added", {
					mediaId: media.id,
					filePath: media.filePath,
				});
			} catch (error) {
				logger.warn(
					{ err: error, mediaId: media.id },
					"Failed to publish registered download event",
				);
			}
		}
		await fs
			.rm(checkpoint.stagingDirectory, { recursive: true, force: true })
			.catch((error) => {
				logger.warn(
					{ err: error },
					"Failed to clean up completed download staging",
				);
			});
	}
}

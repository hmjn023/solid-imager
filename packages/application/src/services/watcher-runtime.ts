import type { ProcessMediaJobRepository } from "../ports/job-repository";
import type { MediaSourceEventPublisher } from "./runtime-events";
import { createTimestamp } from "./runtime-events";

export type WatcherMediaRecord = {
	id: string;
	filePath: string;
};

export type WatcherChangeMetadata = {
	width: number;
	height: number;
	fileSize: number | null;
	modifiedAt: Date;
};

export type WatcherDeleteDeps = {
	findByPath(
		mediaSourceId: string,
		relativePath: string,
	): Promise<WatcherMediaRecord | null>;
	deleteMedia(mediaId: string): Promise<void>;
	deleteThumbnail?(mediaSourceId: string, mediaId: string): Promise<void>;
	events: Pick<MediaSourceEventPublisher, "mediaDeleted">;
};

export type WatcherDeleteDirectoryDeps = {
	deleteByPathPrefix(
		mediaSourceId: string,
		relativePath: string,
	): Promise<WatcherMediaRecord[]>;
	events: Pick<MediaSourceEventPublisher, "mediaDeleted">;
};

export type WatcherChangeDeps = {
	findByPath(
		mediaSourceId: string,
		relativePath: string,
	): Promise<WatcherMediaRecord | null>;
	updateMedia(mediaId: string, data: WatcherChangeMetadata): Promise<void>;
	queueProcessMedia(input: {
		jobRepo: ProcessMediaJobRepository;
		mediaId: string;
		mediaSourceId: string;
		sourcePath: string;
	}): Promise<void>;
	jobRepo: ProcessMediaJobRepository;
	events: Pick<MediaSourceEventPublisher, "mediaChanged">;
	onMissing(): Promise<void>;
};

export async function deleteWatchedFile(
	mediaSourceId: string,
	relativePath: string,
	deps: WatcherDeleteDeps,
): Promise<boolean> {
	const existing = await deps.findByPath(mediaSourceId, relativePath);
	if (!existing) {
		return false;
	}

	await deps.deleteMedia(existing.id);
	await deps.deleteThumbnail?.(mediaSourceId, existing.id);
	await deps.events.mediaDeleted({
		mediaSourceId,
		mediaId: existing.id,
		filePath: existing.filePath,
		timestamp: createTimestamp(),
	});
	return true;
}

export async function deleteWatchedDirectory(
	mediaSourceId: string,
	relativePath: string,
	deps: WatcherDeleteDirectoryDeps,
): Promise<number> {
	const deletedRecords = await deps.deleteByPathPrefix(
		mediaSourceId,
		relativePath,
	);
	for (const record of deletedRecords) {
		await deps.events.mediaDeleted({
			mediaSourceId,
			mediaId: record.id,
			filePath: record.filePath,
			timestamp: createTimestamp(),
		});
	}
	return deletedRecords.length;
}

export async function changeWatchedFile(
	mediaSourceId: string,
	relativePath: string,
	sourcePath: string,
	metadata: WatcherChangeMetadata,
	deps: WatcherChangeDeps,
): Promise<void> {
	const existing = await deps.findByPath(mediaSourceId, relativePath);
	if (!existing) {
		await deps.onMissing();
		return;
	}

	await deps.updateMedia(existing.id, metadata);
	await deps.queueProcessMedia({
		jobRepo: deps.jobRepo,
		mediaId: existing.id,
		mediaSourceId,
		sourcePath,
	});
	await deps.events.mediaChanged({
		mediaSourceId,
		mediaId: existing.id,
		filePath: existing.filePath,
		timestamp: createTimestamp(),
	});
}

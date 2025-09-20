import {
	deleteMediaSource as dbDeleteMediaSource,
	insertMediaSource as dbInsertMediaSource,
	selectMediaSources as dbSelectMediaSources,
	updateMediaSource as dbUpdateMediaSource,
} from "~/db/index";
import type { MediaSource, NewMediaSource } from "~/db/schema"; // Import Drizzle types
import type { UUID } from "~/lib/utils";

export async function getMediaSources() {
	return dbSelectMediaSources();
}

export async function createMediaSource(mediaSource: NewMediaSource) {
	return dbInsertMediaSource(mediaSource);
}

export async function updateMediaSource(sourceId: UUID, data: MediaSource) {
	return dbUpdateMediaSource(sourceId, data);
}

export async function deleteMediaSource(sourceId: UUID) {
	return dbDeleteMediaSource(sourceId);
}

export async function testMediaSourceConnection(sourceId: UUID) {
	console.log("Placeholder: testMediaSourceConnection called", { sourceId });
	return { success: true, message: "Connection successful" };
}

export async function getMediaSourceStatus(sourceId: UUID) {
	console.log("Placeholder: getMediaSourceStatus called", { sourceId });
	return { sourceId, status: "active", lastSync: new Date() };
}

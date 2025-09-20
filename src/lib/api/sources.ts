import { insertMediaSource } from "~/db/index";
import type { mediaSourceInfo } from "~/lib/types";
import type { UUID } from "~/lib/utils";

export async function getMediaSources() {
	console.log("Placeholder: getMediaSources called");
	return [];
}

export async function createMediaSource(mediaSource: mediaSourceInfo) {
	return insertMediaSource(mediaSource);
}

export async function getMediaSourceById(sourceId: UUID) {
	console.log("Placeholder: getMediaSourceById called", { sourceId });
	return { id: sourceId, name: `Source ${sourceId}`, type: "local" };
}

export async function updateMediaSource(sourceId: UUID, data: any) {
	console.log("Placeholder: updateMediaSource called", { sourceId, data });
	return { id: sourceId, name: data.name || `Source ${sourceId}` };
}

export async function deleteMediaSource(sourceId: UUID) {
	console.log("Placeholder: deleteMediaSource called", { sourceId });
	return { success: true };
}

export async function testMediaSourceConnection(sourceId: UUID) {
	console.log("Placeholder: testMediaSourceConnection called", { sourceId });
	return { success: true, message: "Connection successful" };
}

export async function getMediaSourceStatus(sourceId: UUID) {
	console.log("Placeholder: getMediaSourceStatus called", { sourceId });
	return { sourceId, status: "active", lastSync: new Date() };
}

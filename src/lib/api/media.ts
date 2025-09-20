import type { UUID } from "~/lib/utils";

export async function getMediaDetails(sourceId: UUID, mediaId: UUID) {
	console.log("Placeholder: getMediaDetails called", { sourceId, mediaId });
	return {
		sourceId,
		mediaId,
		tags: [],
		metadata: {},
		categories: [],
		ips: [],
		characters: [],
	};
}

export async function updateMedia(sourceId: UUID, mediaId: UUID, data: any) {
	console.log("Placeholder: updateMedia called", { sourceId, mediaId, data });
	return { success: true, updatedFields: Object.keys(data) };
}

export async function getMediaMetadata(sourceId: UUID, mediaId: UUID) {
	console.log("Placeholder: getMediaMetadata called", { sourceId, mediaId });
	return { sourceId, mediaId, metadata: {} };
}

export async function getMediaTags(sourceId: UUID, mediaId: UUID) {
	console.log("Placeholder: getMediaTags called", { sourceId, mediaId });
	return { sourceId, mediaId, tags: [] };
}

export async function getMediaThumbnail(sourceId: UUID, mediaId: UUID) {
	console.log("Placeholder: getMediaThumbnail called", { sourceId, mediaId });
	return { sourceId, mediaId, thumbnail: "base64_encoded_thumbnail_image" };
}

export async function uploadMedia(
	sourceId: UUID,
	mediaId: UUID,
	path: string,
	file: any,
) {
	console.log("Placeholder: uploadMedia called", {
		sourceId,
		mediaId,
		path,
		file,
	});
	return { success: true, filePath: path };
}

export async function searchMedia(sourceId: UUID, queryParams: any) {
	console.log("Placeholder: searchMedia called", { sourceId, queryParams });
	return { media: [], total: 0, page: 1, limit: 10 };
}

export async function searchMediaInDirectory(
	sourceId: UUID,
	directories: string,
	queryParams: any,
) {
	console.log("Placeholder: searchMediaInDirectory called", {
		sourceId,
		directories,
		queryParams,
	});
	return { media: [], total: 0, page: 1, limit: 10 };
}

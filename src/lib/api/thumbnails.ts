import type { UUID } from "~/lib/utils";

export async function startThumbnailGeneration(sourceId: UUID) {
	console.log("Placeholder: startThumbnailGeneration called", { sourceId });
	return { success: true, message: "Thumbnail generation started" };
}

export async function clearThumbnailCache(sourceId: UUID) {
	console.log("Placeholder: clearThumbnailCache called", { sourceId });
	return { success: true, message: "Thumbnail cache cleared" };
}

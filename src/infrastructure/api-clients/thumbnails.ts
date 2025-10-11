/**
 * Thumbnails API Client
 * Extracted from src/lib/api/thumbnails.ts
 */

export function startThumbnailGeneration(_sourceId: string) {
	return { success: true, message: "Thumbnail generation started" };
}

export function clearThumbnailCache(_sourceId: string) {
	return { success: true, message: "Thumbnail cache cleared" };
}

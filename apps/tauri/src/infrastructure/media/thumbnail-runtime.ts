export function getThumbnailResource(mediaSourceId: string, mediaId: string): string {
	return `/api/sources/${mediaSourceId}/${mediaId}/thumbnail`;
}

export function subscribeToThumbnailReady(
	mediaSourceId: string,
	mediaId: string,
	callback: (url: string) => void,
): () => void {
	// No-op for remote server mode
	return () => {};
}

export function notifyThumbnailReady(mediaSourceId: string, mediaId: string) {
	// No-op for remote server mode
}

export function resetThumbnailRuntimeCache() {
	// No-op for remote server mode
}

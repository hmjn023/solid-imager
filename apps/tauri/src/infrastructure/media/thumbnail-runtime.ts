import { buildAbsoluteUrl } from "~/infrastructure/tauri-fetch-helpers";

export function getThumbnailResource(
	mediaSourceId: string,
	mediaId: string,
): string {
	return buildAbsoluteUrl(`/api/sources/${mediaSourceId}/thumbnail/${mediaId}`);
}

export function buildThumbnailUrl(args: {
	cacheKey: number;
	mediaId: string;
	mediaSourceId: string;
}): string {
	const base = buildAbsoluteUrl(
		`/api/sources/${args.mediaSourceId}/thumbnail/${args.mediaId}`,
	);
	return args.cacheKey ? `${base}?t=${args.cacheKey}` : base;
}

export function buildMediaContentUrl(
	mediaSourceId: string,
	mediaId: string,
): string {
	return buildAbsoluteUrl(`/api/sources/${mediaSourceId}/${mediaId}`);
}

export function notifyThumbnailReady(_mediaId: string) {
	// No-op for remote server mode
}

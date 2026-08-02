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
	size?: 256 | 512;
}): string {
	const base = buildAbsoluteUrl(
		`/api/sources/${args.mediaSourceId}/thumbnail/${args.mediaId}`,
	);
	const query = new URLSearchParams();
	if (args.size) query.set("size", String(args.size));
	if (args.cacheKey) query.set("t", String(args.cacheKey));
	const search = query.toString();
	return search ? `${base}?${search}` : base;
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

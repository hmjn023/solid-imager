export const API_PREFIX = "/api";
export const SCALAR_DOCS_PATH = "/docs/scalar";

export const CONFIG_ROUTE = "/config";
export const MEDIA_CONTENT_ROUTE =
	"/sources/{sourceId}/media/{mediaId}/content";
export const MEDIA_THUMBNAIL_ROUTE =
	"/sources/{sourceId}/media/{mediaId}/thumbnail";
export const JOB_ARTIFACT_ROUTE = "/jobs/{id}/artifact";
export const PIXIV_IMAGE_ROUTE = "/viewer/pixiv/image";
export const PIXIV_ANIMATION_ROUTE = "/viewer/pixiv/animations/{id}";
export const DANBOORU_THUMBNAIL_ROUTE = "/viewer/danbooru/thumbnail";

/** Resolves a server path while retaining a reverse-proxy mount in the base URL. */
export function resolveServerUrl(base: string, serverPath: string): string {
	const url = new URL(base);
	url.pathname = url.pathname.replace(/\/+$/, "") + "/";
	return new URL(serverPath.replace(/^\//, ""), url).href;
}

export function mediaContentPath(sourceId: string, mediaId: string): string {
	return (
		API_PREFIX +
		MEDIA_CONTENT_ROUTE.replace(
			"{sourceId}",
			encodeURIComponent(sourceId),
		).replace("{mediaId}", encodeURIComponent(mediaId))
	);
}

export function mediaThumbnailPath(
	sourceId: string,
	mediaId: string,
	options: { cacheKey?: string | number; size?: 256 | 512 } = {},
): string {
	const path =
		API_PREFIX +
		MEDIA_THUMBNAIL_ROUTE.replace(
			"{sourceId}",
			encodeURIComponent(sourceId),
		).replace("{mediaId}", encodeURIComponent(mediaId));
	const query = new URLSearchParams();
	if (options.size) query.set("size", String(options.size));
	if (options.cacheKey) query.set("t", String(options.cacheKey));
	const search = query.toString();
	return search ? `${path}?${search}` : path;
}

export function pixivAnimationPath(id: number): string {
	return API_PREFIX + PIXIV_ANIMATION_ROUTE.replace("{id}", String(id));
}

const UrlBase = "http://localhost";

export function isJobArtifactDownloadPath(pathname: string): boolean {
	return pathname.replace(/\/+$/, "").endsWith("/jobs/downloadArtifact");
}

export function createRpcResponseHeaders(url: URL | string): Headers {
	const parsedUrl = typeof url === "string" ? new URL(url, UrlBase) : url;
	const headers = new Headers();

	if (isJobArtifactDownloadPath(parsedUrl.pathname)) {
		headers.set("content-type", "application/octet-stream");
	}

	return headers;
}

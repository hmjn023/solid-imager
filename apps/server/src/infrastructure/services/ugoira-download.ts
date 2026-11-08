import fs from "node:fs/promises";
import type { DownloadItem } from "@solid-imager/core/media";

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const ARCHIVE_FILENAME = /\/(\d+)(?:-[a-z0-9]+)?_ugoira\d+x\d+\.zip$/i;
const ARTWORK_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?artworks\/(\d+)\/?$/i;

/** Only fetch Pixiv archives paired with their own artwork page. */
function archiveRequest(item: DownloadItem): { url: string; referer: string } {
	const url = new URL(item.targetUrl ?? "");
	const page = new URL(item.sourceUrls?.at(-1) ?? "");
	const id = url.pathname.match(ARCHIVE_FILENAME)?.[1];
	if (
		url.origin !== "https://i.pximg.net" ||
		url.username ||
		url.password ||
		!url.pathname.startsWith("/img-zip-ugoira/") ||
		!id ||
		page.origin !== "https://www.pixiv.net" ||
		page.username ||
		page.password ||
		page.pathname.match(ARTWORK_PATH)?.[1] !== id
	) {
		throw new Error(
			"Ugoira requires a Pixiv ZIP URL and its matching artwork page",
		);
	}
	return { url: url.href, referer: `https://www.pixiv.net/artworks/${id}` };
}

/** Stream the archive to a temporary path with a fixed memory and size bound. */
export async function downloadUgoiraArchive(
	item: DownloadItem,
	destination: string,
): Promise<void> {
	const { url, referer } = archiveRequest(item);
	const response = await fetch(url, {
		redirect: "error",
		signal: AbortSignal.timeout(120_000),
		headers: {
			Referer: referer,
			Accept: "application/zip, application/octet-stream",
			...(item.userAgent ? { "User-Agent": item.userAgent } : {}),
		},
	});
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`Failed to download ugoira: HTTP ${response.status}`);
	}
	const contentType = response.headers
		.get("content-type")
		?.split(";", 1)[0]
		.trim()
		.toLowerCase();
	if (
		!contentType ||
		![
			"application/zip",
			"application/x-zip-compressed",
			"application/octet-stream",
		].includes(contentType)
	) {
		await response.body?.cancel();
		throw new Error(
			`Ugoira URL returned an unsupported content type: ${contentType ?? "unknown"}`,
		);
	}
	if (Number(response.headers.get("content-length")) > MAX_ARCHIVE_BYTES) {
		await response.body?.cancel();
		throw new Error("Ugoira archive exceeds 256 MiB");
	}
	if (!response.body) throw new Error("Ugoira archive response has no body");
	const body = response.body;
	const file = await fs
		.open(destination, "wx")
		.catch(async (error: unknown) => {
			await body.cancel().catch(() => {});
			throw error;
		});
	const reader = body.getReader();
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > MAX_ARCHIVE_BYTES)
				throw new Error("Ugoira archive exceeds 256 MiB");
			await file.writeFile(value);
		}
		if (size === 0) throw new Error("Ugoira archive is empty");
	} catch (error) {
		await reader.cancel().catch(() => {});
		throw error;
	} finally {
		reader.releaseLock();
		await file.close();
	}
}

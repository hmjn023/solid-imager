import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pixivDownloadItem } from "@solid-imager/core/external-viewer";
import { pixivSessions, pixivBearerToken } from "./pixiv-sessions";
import { createPixivService } from "./pixiv-service";
import { downloadUgoiraArchive } from "./ugoira-download";
import { convertUgoiraToMp4 } from "./ugoira-converter";

async function render(id: number, sessionId?: string): Promise<Blob> {
	const post = await createPixivService(fetch, sessionId).getPost(id);
	const item = pixivDownloadItem(post, 0);
	if (!post.animation || !item?.ugoira)
		throw new Error("うごイラを取得できませんでした。");
	const dir = await mkdtemp(path.join(tmpdir(), "solid-imager-pixiv-preview-"));
	try {
		const archive = path.join(dir, "frames.zip"),
			output = path.join(dir, "preview.mp4");
		await downloadUgoiraArchive(item, archive);
		await convertUgoiraToMp4(archive, output, item.ugoira.frames);
		if ((await stat(output)).size > 64 * 1024 * 1024)
			throw new Error("プレビューのサイズ上限を超えました。");
		return new Blob([await readFile(output)], { type: "video/mp4" });
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}
let last: { key: string; blob: Blob; expires: number } | undefined;
const inFlight = new Map<string, Promise<Blob>>();
export async function servePixivAnimation(
	id: number,
	authorization?: string | null,
) {
	if (!Number.isSafeInteger(id) || id < 1)
		return new Response(null, { status: 400 });
	let token, sessionId;
	try {
		token = pixivBearerToken(authorization);
		sessionId = pixivSessions.credential(token);
	} catch {
		return new Response(null, { status: 401 });
	}
	const key = (token ?? "guest") + "/" + id;
	if (last?.key === key && last.expires > Date.now()) return video(last.blob);
	let work = inFlight.get(key);
	if (!work) {
		if (inFlight.size >= 2) return new Response(null, { status: 429 });
		work = render(id, sessionId)
			.then((blob) => {
				last = { key, blob, expires: Date.now() + 300_000 };
				return blob;
			})
			.finally(() => inFlight.delete(key));
		inFlight.set(key, work);
	}
	try {
		return video(await work);
	} catch {
		return new Response("うごイラを再生できませんでした。", { status: 502 });
	}
}
function video(blob: Blob) {
	return new Response(blob, {
		headers: {
			"Content-Type": "video/mp4",
			"Content-Length": String(blob.size),
			"Cache-Control": "private, no-store",
		},
	});
}

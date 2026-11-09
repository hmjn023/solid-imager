import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pixivDownloadItem } from "@solid-imager/core/external-viewer";
import { pixivService } from "./pixiv-service";
import { downloadUgoiraArchive } from "./ugoira-download";
import { convertUgoiraToMp4 } from "./ugoira-converter";

async function render(id: number): Promise<Blob> {
	const post = await pixivService.getPost(id);
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
let last: { id: number; blob: Blob; expires: number } | undefined;
const inFlight = new Map<number, Promise<Blob>>();
export async function servePixivAnimation(id: number) {
	if (!Number.isSafeInteger(id) || id < 1)
		return new Response(null, { status: 400 });
	if (last?.id === id && last.expires > Date.now()) return video(last.blob);
	let work = inFlight.get(id);
	if (!work) {
		if (inFlight.size >= 2) return new Response(null, { status: 429 });
		work = render(id)
			.then((blob) => {
				last = { id, blob, expires: Date.now() + 300_000 };
				return blob;
			})
			.finally(() => inFlight.delete(id));
		inFlight.set(id, work);
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
			"Cache-Control": "private, max-age=300",
		},
	});
}

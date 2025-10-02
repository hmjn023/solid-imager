import { type APIEvent, json } from "solid-start/api";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getMedia } from "~/lib/api/media";
import { generateThumbnail } from "~/lib/thumbnails";
import { selectMediaSourceById } from "~/db";

function getThumbnailPath(mediaId: string): string {
  return path.join(".cache/thumbnails", `${mediaId}.webp`);
}

export async function GET({ params }: APIEvent) {
  try {
    const media = await getMedia(params.sourceId, params.mediaId);
    const thumbnailPath = getThumbnailPath(media.id);

    try {
      // サムネイルが存在するか確認します。
      await fs.stat(thumbnailPath);
    } catch (error) {
      // 存在しない場合、オンデマンドで生成します。
      const sources = await selectMediaSourceById(media.sourceId);
      if (sources.length === 0 || sources[0].type !== "local") {
        return json({ error: "Source not found or not a local source" }, { status: 400 });
      }
      const sourcePath = sources[0].connectionInfo.path;
      await generateThumbnail(media, sourcePath);
    }

    // ファイルをストリームします。
    const fileStream = await fs.readFile(thumbnailPath);
    return new Response(fileStream, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
      },
    });
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return json({ error: "Media not found" }, { status: 404 });
    }
    console.error("Failed to serve thumbnail:", error);
    return json({ error: "Failed to serve thumbnail" }, { status: 500 });
  }
}

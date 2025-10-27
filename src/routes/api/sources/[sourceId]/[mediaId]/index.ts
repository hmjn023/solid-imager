import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import type { UUID } from "~/domain/shared/types";
import { getMedia, updateMedia } from "~/infrastructure/api-clients/media";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";

// パスパラメータのスキーマ
const MediaParamsSchema = z.object({
  sourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

// PUTリクエストボディのスキーマ（例、必要に応じて調整）
const UpdateMediaBodySchema = z.object({
  description: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  // 更新可能な他のフィールドを追加
});

/**
 *
 * @param param0 {sourceId: UUID, mediaId: UUID}
 * @returns メディア
 */
export async function GET({ params }: APIEvent) {
  const parsedParams = MediaParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { sourceId, mediaId } = parsedParams.data;

  try {
    const media = await getMedia(sourceId as UUID, mediaId as UUID);
    const source = await selectMediaSourceById(sourceId as UUID);

    if (!source || source.type !== "local") {
      return new Response("Media source not found or not local", {
        status: 404,
      });
    }

    const imagePath = path.join(source.connectionInfo.path, media.filePath);
    const imageBuffer = await fs.readFile(imagePath);

    return new Response(imageBuffer, {
      status: 200,
      headers: { "Content-Type": `image/${media.mediaType}` },
    });
  } catch (_error) {
    return new Response("Original image not found", { status: 404 });
  }
}

/**
 * 特定メディア情報更新
 * @param param0 {sourceId: UUID, mediaId: UUID}
 * @returns 更新結果
 */
export async function PUT({ params, request }: APIEvent) {
  const parsedParams = MediaParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { sourceId, mediaId } = parsedParams.data;

  const body = await request.json();
  const parsedBody = UpdateMediaBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const data = parsedBody.data;

  const result = await updateMedia(sourceId, mediaId, data);
  return result;
}

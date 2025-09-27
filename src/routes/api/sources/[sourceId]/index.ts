import type { APIEvent } from "@solidjs/start/server";
import {
  deleteMediaSource,
  getMediaSourceById,
  updateMediaSource,
} from "~/lib/api/sources";
import type { UUID } from "~/lib/utils";

/**
 *
 * @param param0 {sourceId: UUID}
 * @returns 画像ソース内のすべてのメディア
 */
export async function GET({ params }: APIEvent) {
  try {
    const sourceId = params.sourceId as UUID;
    const source = await getMediaSourceById(sourceId);
    if (!source) {
      return new Response(JSON.stringify({ error: "Source not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    return Response.json(source);
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Failed to fetch source" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * メディアソースを更新します。
 *
 * @param param0 {sourceId: UUID}
 * @returns 更新されたメディアソース
 */
export async function PUT({ params, request }: APIEvent) {
  try {
    const sourceId = params.sourceId as UUID;
    const data = await request.json();
    const updatedSource = await updateMediaSource(sourceId, data);
    return Response.json(updatedSource);
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Failed to update source" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * メディアソースを削除します。
 *
 * @param param0 {sourceId: UUID}
 * @returns 削除結果
 */
export async function DELETE({ params }: APIEvent) {
  try {
    const sourceId = params.sourceId as UUID;
    const result = await deleteMediaSource(sourceId);
    return Response.json({ success: true, result });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Failed to delete source" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

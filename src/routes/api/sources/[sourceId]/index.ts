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
    return new Response(JSON.stringify(source), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching source:", error);
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
    return new Response(JSON.stringify(updatedSource), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error updating source:", error);
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
    return new Response(JSON.stringify({ success: true, result }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error deleting source:", error);
    return new Response(JSON.stringify({ error: "Failed to delete source" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

import type { APIEvent } from "@solidjs/start/server";
import type { UUID } from "~/domain/shared/types";
import {
  deleteMediaSource,
  getMediaSourceById,
  updateMediaSource,
} from "~/infrastructure/api-clients/sources";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_NOT_FOUND = 404;

/**
 *
 * @param param0 {sourceId: UUID}
 * @returns 画像ソース内のすべてのメディア
 */
export async function GET({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  try {
    const result = await getMediaSourceById(sourceId);
    if (!result) {
      return new Response(JSON.stringify({ error: "Source not found" }), {
        status: HTTP_STATUS_NOT_FOUND,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status:
        (error instanceof FetchError && error.status) ||
        HTTP_STATUS_INTERNAL_SERVER_ERROR,
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
  const sourceId = params.sourceId as UUID;
  const data = await request.json();

  try {
    const result = await updateMediaSource(sourceId, data);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || HTTP_STATUS_INTERNAL_SERVER_ERROR,
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
  const sourceId = params.sourceId as UUID;

  try {
    const result = await deleteMediaSource(sourceId);
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

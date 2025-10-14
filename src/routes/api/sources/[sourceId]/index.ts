import type { APIEvent } from "@solidjs/start/server";
import { Effect, pipe } from "effect";
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
  const result = await pipe(getMediaSourceById(sourceId), Effect.runPromise);

  if (
    result &&
    typeof result === "object" &&
    "_tag" in result &&
    result._tag === "FetchError"
  ) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: result.status || HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
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

  const result = await pipe(
    updateMediaSource(sourceId, data),
    Effect.runPromise
  );

  if (
    result &&
    typeof result === "object" &&
    "_tag" in result &&
    result._tag === "FetchError"
  ) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: result.status || HTTP_STATUS_INTERNAL_SERVER_ERROR,
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
}

/**
 * メディアソースを削除します。
 *
 * @param param0 {sourceId: UUID}
 * @returns 削除結果
 */
export async function DELETE({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;

  const result = await pipe(deleteMediaSource(sourceId), Effect.runPromise);

  if (
    result &&
    typeof result === "object" &&
    "_tag" in result &&
    result._tag === "FetchError"
  ) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: result.status || HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

import type { APIEvent } from "@solidjs/start/server";
import { Effect, pipe } from "effect";
import type { UUID } from "~/domain/shared/types";
import {
  deleteMediaSource,
  getMediaSourceById,
  updateMediaSource,
} from "~/infrastructure/api-clients/sources";

/**
 *
 * @param param0 {sourceId: UUID}
 * @returns 画像ソース内のすべてのメディア
 */
export async function GET({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;
  const result = await pipe(
    Effect.tryPromise({
      try: () => getMediaSourceById(sourceId),
      catch: (error) => new Error(`Failed to fetch source: ${error}`),
    }),
    Effect.runPromise,
  );

  if (result instanceof Error) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  if (!result) {
    return new Response(JSON.stringify({ error: "Source not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  return result;
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
    Effect.tryPromise({
      try: () => updateMediaSource(sourceId, data),
      catch: (error) => new Error(`Failed to update source: ${error}`),
    }),
    Effect.runPromise,
  );

  if (result instanceof Error) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  return result;
}

/**
 * メディアソースを削除します。
 *
 * @param param0 {sourceId: UUID}
 * @returns 削除結果
 */
export async function DELETE({ params }: APIEvent) {
  const sourceId = params.sourceId as UUID;

  const result = await pipe(
    Effect.tryPromise({
      try: () => deleteMediaSource(sourceId),
      catch: (error) => new Error(`Failed to delete source: ${error}`),
    }),
    Effect.runPromise,
  );

  if (result instanceof Error) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  return { success: true, result };
}

import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { getAllMedia } from "~/infrastructure/api-clients/media";
import {
  deleteMediaSource,
  updateMediaSource,
} from "~/infrastructure/api-clients/sources";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_BAD_REQUEST = 400;

const SourceParamsSchema = z.object({
  sourceId: z.string().uuid(),
});

/**
 *
 * @param param0 {sourceId: UUID}
 * @returns 画像ソース内のすべてのメディア
 */
export async function GET({ params }: APIEvent) {
  const parsedParams = SourceParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: HTTP_STATUS_BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { sourceId } = parsedParams.data;

  try {
    const result = await getAllMedia(sourceId);
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
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
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
  const parsedParams = SourceParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: HTTP_STATUS_BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { sourceId } = parsedParams.data;
  const data = await request.json();

  try {
    const result = await updateMediaSource(sourceId, data);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
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
  const parsedParams = SourceParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: HTTP_STATUS_BAD_REQUEST,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { sourceId } = parsedParams.data;

  try {
    const result = await deleteMediaSource(sourceId);
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

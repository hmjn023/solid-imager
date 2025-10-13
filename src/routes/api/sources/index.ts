import type { APIEvent } from "@solidjs/start/server";
import { Effect, pipe } from "effect";
import {
  createMediaSource,
  getMediaSources,
} from "~/infrastructure/api-clients/sources";

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

/**
 *
 * @returns すべてのメディアソース
 */

export async function GET() {
  const result = await pipe(getMediaSources(), Effect.runPromise);

  if (result && typeof result === "object" && "_tag" in result && result._tag === "FetchError") {
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
 * メディアソースを作成します。
 *
 * @returns 作成されたメディアソース
 */
export async function POST({ request }: APIEvent) {
  const { name, description, type, connectionInfo } = await request.json();

  const result = await pipe(
    createMediaSource({
      name,
      description,
      type,
      connectionInfo,
    }),
    Effect.runPromise
  );

  if (result && typeof result === "object" && "_tag" in result && result._tag === "FetchError") {
    return new Response(JSON.stringify({ error: result.message }), {
      status: result.status || HTTP_STATUS_INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  return new Response(JSON.stringify(result), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

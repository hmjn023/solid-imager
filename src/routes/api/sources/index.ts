import type { APIEvent } from "@solidjs/start/server";
import { Effect, pipe } from "effect";
import {
  createMediaSource,
  getMediaSources,
} from "~/infrastructure/api-clients/sources";

/**
 *
 * @returns すべてのメディアソース
 */

export async function GET() {
  const result = await pipe(
    Effect.tryPromise({
      try: () => getMediaSources(),
      catch: (error) => new Error(`Failed to fetch sources: ${error}`),
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
 * メディアソースを作成します。
 *
 * @returns 作成されたメディアソース
 */
export async function POST({ request }: APIEvent) {
  const { name, description, type, connectionInfo } = await request.json();

  const result = await pipe(
    Effect.tryPromise({
      try: () =>
        createMediaSource({
          name,
          description,
          type,
          connectionInfo,
        }),
      catch: (error) => new Error(`Failed to create source: ${error}`),
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

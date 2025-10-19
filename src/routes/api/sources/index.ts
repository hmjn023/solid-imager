import type { APIEvent } from "@solidjs/start/server";
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
  try {
    const result = await getMediaSources();
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
 * メディアソースを作成します。
 *
 * @returns 作成されたメディアソース
 */
export async function POST({ request }: APIEvent) {
  const { name, description, type, connectionInfo } = await request.json();

  try {
    const result = await createMediaSource({
      name,
      description,
      type,
      connectionInfo,
    });
    return new Response(JSON.stringify(result), {
      status: 201,
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

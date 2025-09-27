import type { APIEvent } from "@solidjs/start/server";
import { createMediaSource, getMediaSources } from "~/lib/api/sources";

/**
 *
 * @returns すべてのメディアソース
 */

export async function GET() {
  try {
    const sources = await getMediaSources();
    return Response.json(sources);
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Failed to fetch sources" }), {
      status: 500,
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
  try {
    const { name, description, type, connectionInfo } = await request.json();
    const newSource = await createMediaSource({
      name,
      description,
      type,
      connectionInfo,
    });
    return new Response(JSON.stringify(newSource), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Failed to create source" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

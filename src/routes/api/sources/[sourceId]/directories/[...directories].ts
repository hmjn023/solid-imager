import type { APIEvent } from "@solidjs/start/server";
import { listMedia } from "~/lib/api/media";

export async function GET({ params }: APIEvent) {
  try {
    const mediaList = await listMedia(params.sourceId, params.directories);
    return mediaList;
  } catch (error: any) {
    return {
      error: error.message,
      status: 500,
    };
  }
}

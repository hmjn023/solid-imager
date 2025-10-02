import { type APIEvent, json } from "solid-start/api";
import { listMedia } from "~/lib/api/media";

export async function GET({ params }: APIEvent) {
  try {
    const mediaList = await listMedia(params.sourceId, params.directories);
    return json(mediaList);
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

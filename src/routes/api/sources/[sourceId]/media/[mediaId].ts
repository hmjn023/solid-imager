import { type APIEvent, json } from "solid-start/api";
import {
  deleteMedia,
  getMedia,
  updateMedia,
} from "~/lib/api/media";
import type { updateMediaRequestSchema } from "~/lib/schemas";
import type { z } from "zod";

type UpdateMediaRequest = z.infer<typeof updateMediaRequestSchema>;

export async function GET({ params }: APIEvent) {
  try {
    const media = await getMedia(params.sourceId, params.mediaId);
    return json(media);
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return json({ error: "Media not found" }, { status: 404 });
    }
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PUT({ params, request }: APIEvent) {
  try {
    const updates = (await request.json()) as UpdateMediaRequest;
    const updatedMedia = await updateMedia(params.sourceId, params.mediaId, updates);
    return json(updatedMedia);
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return json({ error: "Media not found" }, { status: 404 });
    }
    return json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE({ params }: APIEvent) {
  try {
    await deleteMedia(params.sourceId, params.mediaId);
    return json({ success: true });
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return json({ error: "Media not found" }, { status: 404 });
    }
    return json({ error: error.message }, { status: 500 });
  }
}

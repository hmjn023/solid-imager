import { type APIEvent, json } from "solid-start/api";
import { generateThumbnailsForSource } from "~/lib/thumbnails";

export async function POST({ params }: APIEvent) {
  try {
    const count = await generateThumbnailsForSource(params.sourceId);
    return json(
      {
        message: `Thumbnail generation job started for ${count} items.`,
      },
      { status: 202 },
    );
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return json({ error: "Source not found" }, { status: 404 });
    }
    return json({ error: error.message }, { status: 500 });
  }
}

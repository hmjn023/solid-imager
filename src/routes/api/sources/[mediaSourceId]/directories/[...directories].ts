import type { APIEvent } from "solid-start/api";
import { MediaService } from "~/application/services/media-service";

export async function GET({ params }: APIEvent) {
  try {
    const { sourceId } = params;
    const directories = params.directories.split("/");

    if (!sourceId) {
      return new Response(JSON.stringify({ error: "Source ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Assuming searchMediaInDirectory can handle an array of directory segments
    // and will return media within that path.
    const mediaList = await MediaService.searchMediaInDirectory(
      sourceId,
      directories.join("/"), // Re-join for the service
      {} // No search options for now
    );

    return new Response(JSON.stringify(mediaList), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

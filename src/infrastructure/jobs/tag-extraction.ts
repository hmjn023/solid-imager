import { ImageProcessor } from "~/domain/media/processing/image-processor";
import { insertMediaTags } from "~/infrastructure/db/queries/tags";

/**
 * Extracts tags from a media file and saves them to the database.
 * @param {string} mediaPath - The path to the media file.
 * @param {string} mediaId - The ID of the media item.
 * @returns {Promise<void>} A promise that resolves when the tags have been extracted and saved.
 */
export async function extractTags(
  mediaPath: string,
  mediaId: string
): Promise<void> {
  const metadata = await ImageProcessor.extractMetadata(mediaPath, mediaId);
  const tagsToInsert = metadata.tags.map((tag) => ({
    name: tag,
    type: "positive" as const,
  }));
  await insertMediaTags(mediaId, tagsToInsert, "extracted_from_workflow");
}

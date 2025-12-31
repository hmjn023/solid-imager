import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";

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
  const metadata = await ImageProcessor.extractMetadata(mediaPath);
  const tagsToInsert = metadata.tags.map((tag) => ({
    name: tag.name,
    type: tag.type,
  }));
  // We might want to use a different source or keep "extracted_from_workflow"
  // ImageProcessor already inserts them as "comfyui_workflow".
  // If we want to duplicate them as "extracted_from_workflow", we can.
  // But maybe we should just rely on ImageProcessor?
  // For now, let's keep the behavior but fix the type error.
  if (tagsToInsert.length > 0) {
    await TagRepository.addTagsToMedia(
      mediaId,
      tagsToInsert,
      "extracted_from_workflow"
    );
  }
}

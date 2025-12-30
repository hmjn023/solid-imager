/**
 * Media Processing - Image, Video, Audio Processors
 * Extracted from src/lib/helpers/image-processor.ts
 * Feature 17.2: メディア処理 / 情報抽出
 */

import sharp from "sharp";
import type { ImageMetadataComment } from "~/domain/media/schemas";
import { extractDataFromComments } from "~/domain/media/utils/metadata-utils";
import { upsertMediaGenerationInfo } from "~/infrastructure/db/queries/media-generation-info";
/**
 * Provides image processing functionalities such as thumbnail generation, metadata extraction, and dimension retrieval.
 */
import { logger } from "~/infrastructure/logger";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";

/**
 * Provides image processing functionalities such as thumbnail generation, metadata extraction, and dimension retrieval.
 */
export const ImageProcessor = {
  /**
   * Generates a thumbnail for a given image.
   * @param {string} mediaPath - The path to the source image file.
   * @param {string} outputPath - The path where the thumbnail will be saved.
   * @param {number} size - The desired size for the thumbnail (e.g., width or height, depending on implementation).
   * @returns {Promise<void>} A promise that resolves when the thumbnail has been generated.
   */
  async generateThumbnail(
    mediaPath: string,
    outputPath: string,
    size: number,
    quality: number
  ): Promise<void> {
    await sharp(mediaPath)
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toFile(outputPath);
  },

  /**
   * Extracts metadata from an image file.
   * @param {string} mediaPath - The path to the source image file.
   * @param {string} mediaId - The ID of the media item.
   * @returns {Promise<void>} A promise that resolves when the metadata has been extracted and stored.
   */
  async extractMetadata(
    mediaPath: string,
    mediaId: string
  ): Promise<{
    tags: { name: string; type: "positive" | "negative" }[];
    prompt: unknown;
    workflow: unknown;
  }> {
    if (!mediaPath) {
      throw new Error("Image path is required");
    }

    try {
      const metadata = await sharp(mediaPath).metadata();

      const comments: ImageMetadataComment[] = [];
      if (metadata.comments) {
        comments.push(...metadata.comments);
      }
      // Attempt to read from EXIF fields
      // biome-ignore lint/suspicious/noExplicitAny: exif structure is dynamic
      const exif = (metadata.exif as any)?.IFD0;
      if (exif) {
        if (exif.UserComment) {
          // It might be a Buffer, so convert it
          const comment = Buffer.isBuffer(exif.UserComment)
            ? exif.UserComment.toString("utf-8")
            : exif.UserComment;
          comments.push({ keyword: "workflow", text: comment.trim() });
        }
        if (exif.ImageDescription) {
          comments.push({
            keyword: "prompt",
            text: exif.ImageDescription.trim(),
          });
        }
      }

      const { tags, prompt, workflow } = extractDataFromComments(comments);

      // Store generation info
      await upsertMediaGenerationInfo(
        mediaId,
        // Ensure prompt is stored as a string if it's an object
        typeof prompt === "object" ? JSON.stringify(prompt) : prompt,
        workflow as object | null
      );

      // Store tags
      if (tags.length > 0) {
        await TagRepository.addTagsToMedia(mediaId, tags, "comfyui_workflow");
      }

      return { tags, prompt, workflow };
    } catch (error) {
      logger.error(
        { err: error, mediaId },
        "[ImageProcessor] Failed to extract metadata"
      );
      return { tags: [], prompt: null, workflow: null };
    }
  },

  /**
   * Retrieves the dimensions (width and height) of an image.
   * @param {string} _mediaPath - The path to the source image file.
   * @returns {Promise<{ width: number; height: number }>} A promise that resolves with an object containing the width and height.
   */
  getDimensions(
    _mediaPath: string
  ): Promise<{ width: number; height: number }> {
    // TODO: Get image dimensions
    throw new Error("Not implemented");
  },
};

/**
 * Provides video processing functionalities such as thumbnail generation from video.
 */
export const VideoProcessor = {
  /**
   * Generates a thumbnail from a video at a specific time.
   * @param {string} _videoPath - The path to the source video file.
   * @param {string} _outputPath - The path where the thumbnail will be saved.
   * @param {string} _time - The timestamp in the video to capture the thumbnail (e.g., "00:00:01").
   * @returns {Promise<void>} A promise that resolves when the thumbnail has been generated.
   */
  generateThumbnail(
    _videoPath: string,
    _outputPath: string,
    _time: string
  ): Promise<void> {
    // TODO: Generate thumbnail from video at specific time
    throw new Error("Not implemented");
  },

  /**
   * Extracts metadata from a video file.
   * @param {string} _videoPath - The path to the source video file.
   * @returns {Promise<unknown>} A promise that resolves with the extracted metadata.
   */
  extractMetadata(_videoPath: string): Promise<unknown> {
    // TODO: Extract video metadata
    throw new Error("Not implemented");
  },
};

/**
 * Provides audio processing functionalities such as waveform generation and metadata extraction.
 */
export const AudioProcessor = {
  /**
   * Generates a waveform visualization for an audio file.
   * @param {string} _audioPath - The path to the source audio file.
   * @param {string} _outputPath - The path where the waveform image will be saved.
   * @returns {Promise<void>} A promise that resolves when the waveform has been generated.
   */
  generateWaveform(_audioPath: string, _outputPath: string): Promise<void> {
    // TODO: Generate audio waveform visualization
    throw new Error("Not implemented");
  },

  /**
   * Extracts metadata from an audio file.
   * @param {string} _audioPath - The path to the source audio file.
   * @returns {Promise<unknown>} A promise that resolves with the extracted metadata.
   */
  extractMetadata(_audioPath: string): Promise<unknown> {
    // TODO: Extract audio metadata
    throw new Error("Not implemented");
  },
};

/**
 * Provides functionality to extract tags from a ComfyUI workflow JSON object.
 */
export const WorkflowTagExtractor = {
  /**
   * Extracts tags from a ComfyUI workflow JSON object.
   * @param {object} _workflowJson - The ComfyUI workflow JSON object.
   * @returns {string[]} An array of extracted tags.
   */
  extractTags(_workflowJson: object): string[] {
    // TODO: Extract tags from ComfyUI workflow JSON
    throw new Error("Not implemented");
  },
};

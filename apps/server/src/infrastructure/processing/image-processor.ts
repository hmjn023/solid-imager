/**
 * Media Processing - Image, Video, Audio Processors
 * Extracted from src/lib/helpers/image-processor.ts
 * Feature 17.2: メディア処理 / 情報抽出
 */

import sharp from "sharp";

// Optimize sharp memory usage
// Default cache is too aggressive for development environment
sharp.cache({ memory: 100, items: 200, files: 20 });

import type { ImageMetadataComment } from "@solid-imager/core/domain/media/schemas";
import { extractDataFromComments } from "@solid-imager/core/domain/media/utils/metadata-utils";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import { services } from "~/application/registry";
import { logger } from "~/infrastructure/logger";
import { checkFfmpegAvailable, getFfmpeg } from "~/infrastructure/utils/ffmpeg";

const RANDOM_STRING_RADIX = 36;
let isFfmpegAvailable: boolean | undefined;

/**
 * Provides image processing functionalities such as thumbnail generation, metadata extraction, and dimension retrieval.
 */
export class LocalImageProcessor implements IImageProcessor {
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
		quality: number,
	): Promise<void> {
		const path = await import("node:path");
		const ext = path.extname(mediaPath).toLowerCase();

		// Check if it is a video
		if ([".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(ext)) {
			logger.info({ mediaPath }, "[ImageProcessor] Generating video thumbnail");

			// Verify ffmpeg availability
			if (isFfmpegAvailable === undefined) {
				isFfmpegAvailable = await checkFfmpegAvailable();
			}

			if (!isFfmpegAvailable) {
				logger.error(
					{ mediaPath },
					"[ImageProcessor] ffmpeg binary not found. Cannot generate video thumbnail.",
				);
				throw new Error(
					"ffmpeg is not installed or not in PATH. Please install ffmpeg to support video thumbnails.",
				);
			}

			const ffmpeg = getFfmpeg();
			const os = (await import("node:os")).default;
			const fs = (await import("node:fs/promises")).default;

			// Use a temp file for the screenshot

			const tempScreenshot = path.join(
				os.tmpdir(),
				`thumb-${Date.now()}-${Math.random().toString(RANDOM_STRING_RADIX).slice(2)}.png`,
			);

			try {
				await new Promise<void>((resolve, reject) => {
					ffmpeg(mediaPath)
						.screenshots({
							timestamps: ["10%"], // Take screenshot at 10%
							filename: path.basename(tempScreenshot),
							folder: path.dirname(tempScreenshot),
							size: `${size}x?`, // Resize during screenshot
						})
						.on("end", () => resolve())
						.on("error", (err) => reject(err));
				});

				// Process the screenshot with sharp (convert to webp)
				await sharp(tempScreenshot)
					.resize(size, size, { fit: "inside", withoutEnlargement: true })
					.webp({ quality })
					.toFile(outputPath);

				logger.info(
					{ outputPath },
					"[ImageProcessor] Video thumbnail generated",
				);
			} catch (error) {
				logger.error(
					{ err: error, mediaPath },
					"[ImageProcessor] Failed to generate video thumbnail",
				);
				throw error;
			} finally {
				// Clean up temp file
				fs.unlink(tempScreenshot).catch((err) =>
					logger.warn({ err }, "Failed to clean up temporary screenshot file"),
				);
			}
			return;
		}

		// Default image processing
		try {
			// Validate JPEG integrity before processing
			const { readFileSync } = await import("node:fs");
			const content = readFileSync(mediaPath);
			if (content.length >= 2 && content[0] === 0xff && content[1] === 0xd8) {
				if (
					content.length < 2 ||
					content[content.length - 2] !== 0xff ||
					content[content.length - 1] !== 0xd9
				) {
					throw new Error(
						`Cannot generate thumbnail: truncated JPEG file (missing FFD9 end marker): ${mediaPath}`,
					);
				}
			}

			await sharp(mediaPath)
				.resize(size, size, { fit: "inside", withoutEnlargement: true })
				.webp({ quality })
				.toFile(outputPath);
		} catch (error) {
			logger.error(
				{ err: error, mediaPath },
				"[ImageProcessor] Failed to generate image thumbnail",
			);
			throw error;
		}
	}

	/**
	 * Extracts metadata from an image file.
	 * @param {string} mediaPath - The path to the source image file.
	 * @returns {Promise<void>} A promise that resolves when the metadata has been extracted and stored.
	 */
	async extractMetadata(mediaPath: string): Promise<{
		tags: { name: string; type: "positive" | "negative" }[];
		prompt: unknown;
		workflow: unknown;
	}> {
		if (!mediaPath) {
			throw new Error("Image path is required");
		}

		try {
			const path = await import("node:path");
			const ext = path.extname(mediaPath).toLowerCase();

			// Skip metadata extraction for videos and audio for now
			if (
				[
					".mp4",
					".webm",
					".mov",
					".mkv",
					".avi",
					".mp3",
					".wav",
					".ogg",
					".m4a",
				].includes(ext)
			) {
				return { tags: [], prompt: null, workflow: null };
			}

			const metadata = await sharp(mediaPath).metadata();

			const comments: ImageMetadataComment[] = [];
			if (metadata.comments) {
				comments.push(...metadata.comments);
			}
			// Attempt to read from EXIF fields
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

			// Get tag extraction options from config with fallback
			let tagExtractionOptions: {
				positiveNodeTypes: string[];
				negativeKeywords: string[];
				negativeTags: string[];
			};
			try {
				const tagExtractionConfig = services.getConfigService().getConfig()
					.media.tagExtraction.comfyui;
				tagExtractionOptions = {
					positiveNodeTypes: tagExtractionConfig.positiveNodeTypes,
					negativeKeywords: tagExtractionConfig.negativeKeywords,
					negativeTags: tagExtractionConfig.negativeTags,
				};
			} catch {
				// Fallback for tests or when ConfigService is not registered
				tagExtractionOptions = {
					positiveNodeTypes: ["CLIPTextEncode", "CR Combine Prompt"],
					negativeKeywords: ["negative"],
					negativeTags: ["lowres"],
				};
			}

			const { tags, prompt, workflow } = extractDataFromComments(
				comments,
				tagExtractionOptions,
			);
			return { tags, prompt, workflow };
		} catch (error) {
			logger.error(
				{ err: error, mediaPath },
				"[ImageProcessor] Failed to extract metadata",
			);
			return { tags: [], prompt: null, workflow: null };
		}
	}

	/**
	 * Retrieves the dimensions (width and height) of an image.
	 * @param {string} mediaPath - The path to the source image file.
	 * @returns {Promise<{ width: number; height: number }>} A promise that resolves with an object containing the width and height.
	 */
	async getDimensions(
		mediaPath: string,
	): Promise<{ width: number; height: number }> {
		const path = await import("node:path");
		const ext = path.extname(mediaPath).toLowerCase();

		// Handle videos
		if ([".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(ext)) {
			const ffmpeg = getFfmpeg();
			return new Promise((resolve, reject) => {
				ffmpeg.ffprobe(mediaPath, (err, probeData) => {
					if (err) {
						reject(err);
						return;
					}
					const videoStream = probeData.streams.find(
						(s) => s.codec_type === "video",
					);
					if (videoStream?.width && videoStream.height) {
						resolve({ width: videoStream.width, height: videoStream.height });
					} else {
						reject(new Error("No video stream found or dimensions missing"));
					}
				});
			});
		}

		const metadata = await sharp(mediaPath).metadata();
		if (metadata.width === undefined || metadata.height === undefined) {
			throw new Error(`Failed to get dimensions for image: ${mediaPath}`);
		}
		return {
			width: metadata.width,
			height: metadata.height,
		};
	}
}

export const ImageProcessor = new LocalImageProcessor();

/**
 * Provides video processing functionalities such as thumbnail generation from video.
 */
export const VideoProcessor = {
	/**
	 * Generates a thumbnail from a video at a specific time.
	 * @param {string} videoPath - The path to the source video file.
	 * @param {string} outputPath - The path where the thumbnail will be saved.
	 * @param {string} _time - The timestamp in the video to capture the thumbnail (e.g., "00:00:01").
	 * @returns {Promise<void>} A promise that resolves when the thumbnail has been generated.
	 */
	async generateThumbnail(
		videoPath: string,
		outputPath: string,
		_time: string,
	): Promise<void> {
		// Delegate to ImageProcessor which handles videos correctly now
		// Note: ImageProcessor uses a fixed "10%" timestamp currently, ignoring _time.
		// If precision is needed, ImageProcessor needs update.
		// For now, using default implementation.
		await ImageProcessor.generateThumbnail(videoPath, outputPath, 512, 80);
	},

	/**
	 * Extracts metadata from a video file.
	 * @param {string} videoPath - The path to the source video file.
	 * @returns {Promise<unknown>} A promise that resolves with the extracted metadata.
	 */
	extractMetadata(_videoPath: string): Promise<unknown> {
		// Basic metadata via ffmpeg?
		// For now return empty object as we don't have a schema for video metadata to return
		// similar to how extractMetadata works for images (returning tags/prompts).
		return Promise.resolve({});
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

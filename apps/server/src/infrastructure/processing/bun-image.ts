import sharp from "sharp";

/**
 * Opens an image through Bun's native image pipeline.
 *
 * Keeping this boundary in one module makes the server-side Bun dependency
 * explicit and lets Node-based tests replace it without pretending that
 * Bun.Image is available in the test runtime.
 */
export function openBunImage(input: string): Bun.Image {
	return Bun.file(input).image();
}

/**
 * Reads image dimensions with Bun.Image first and sharp as a compatibility
 * fallback for formats Bun cannot decode on every platform.
 */
export async function getImageMetadata(input: string): Promise<{
	width?: number;
	height?: number;
}> {
	try {
		const metadata = await openBunImage(input).metadata();
		return { width: metadata.width, height: metadata.height };
	} catch {
		const metadata = await sharp(input, { failOn: "none" }).metadata();
		return { width: metadata.width, height: metadata.height };
	}
}

/**
 * Generates a WebP thumbnail with Bun.Image first and sharp as a fallback.
 */
export async function writeWebpThumbnail(
	input: string,
	output: string,
	size: number,
	quality: number,
): Promise<void> {
	try {
		await openBunImage(input)
			.resize(size, size, { fit: "inside", withoutEnlargement: true })
			.webp({ quality })
			.write(output);
	} catch {
		await sharp(input, { failOn: "none" })
			.resize(size, size, { fit: "inside", withoutEnlargement: true })
			.webp({ quality })
			.toFile(output);
	}
}

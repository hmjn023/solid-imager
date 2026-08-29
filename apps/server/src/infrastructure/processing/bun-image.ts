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

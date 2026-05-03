/**
 * FFmpeg utility module
 * Provides configured fluent-ffmpeg instance with ffmpeg-static binary path
 */

import ffmpeg from "fluent-ffmpeg";

let ffmpegPath: string | null = null;
let isInitialized = false;
let isResolved = false;

/**
 * Resolve and cache the ffmpeg binary path.
 * Tries ffmpeg-static first, then falls back to system ffmpeg.
 */
async function resolveFfmpegPath(): Promise<string | null> {
	if (isResolved) return ffmpegPath;
	isResolved = true;

	const { existsSync } = await import("node:fs");

	// Try ffmpeg-static first
	try {
		const staticPath = (await import("ffmpeg-static")).default;
		if (staticPath && existsSync(staticPath)) {
			ffmpegPath = staticPath;
			return ffmpegPath;
		}
	} catch (_e) {
		// ffmpeg-static not available
	}

	// Fall back to system ffmpeg
	try {
		const { execFileSync } = await import("node:child_process");
		execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
		ffmpegPath = "ffmpeg";
		return ffmpegPath;
	} catch (_e) {
		ffmpegPath = null;
		return null;
	}
}

/**
 * Check if ffmpeg is available
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
	await resolveFfmpegPath();
	return ffmpegPath !== null;
}

/**
 * Get configured ffmpeg instance.
 * Must call checkFfmpegAvailable() first to resolve the path.
 */
export function getFfmpeg() {
	if (!isInitialized) {
		if (ffmpegPath) {
			ffmpeg.setFfmpegPath(ffmpegPath);
		}
		isInitialized = true;
	}
	return ffmpeg;
}

export { ffmpegPath };

/**
 * FFmpeg utility module
 * Provides configured fluent-ffmpeg instance with ffmpeg-static binary path
 */

import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";

// Set ffmpeg-static path if available
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

/**
 * Check if ffmpeg is available
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
    try {
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFileAsync = promisify(execFile);

        // If ffmpeg-static path is set, use it directly
        const ffmpegBinary = ffmpegPath || "ffmpeg";
        await execFileAsync(ffmpegBinary, ["-version"]);
        return true;
    } catch (_e) {
        return false;
    }
}

/**
 * Get configured ffmpeg instance
 * The ffmpeg path is already set via setFfmpegPath above
 */
export function getFfmpeg() {
    return ffmpeg;
}

export { ffmpegPath };

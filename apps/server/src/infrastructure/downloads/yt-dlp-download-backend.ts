import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
	DownloadBackendCapabilities,
	IDownloadBackend,
} from "@solid-imager/core/domain/services/download-backend";
import ffmpegPath from "ffmpeg-static";
import youtubedl from "youtube-dl-exec";
import { logger } from "~/infrastructure/logger";

const resolvedFfmpegPath = ffmpegPath ?? undefined;

export type YtDlpOutput = {
	id: string;
	title: string;
	description: string;
	duration?: number;
	width?: number;
	height?: number;
	ext: string;
	uploader?: string;
	uploader_id?: string;
	upload_date?: string;
	_filename?: string;
	filename: string;
};

type Cookie = {
	domain: string;
	path: string;
	secure?: boolean;
	expirationDate?: number;
	name: string;
	value: string;
};

const localCapabilities: DownloadBackendCapabilities = {
	kind: "local",
	supportsMetadata: true,
	supportsDownload: true,
};

async function createNetscapeCookieFile(
	cookies: Cookie[],
): Promise<string | null> {
	if (cookies.length === 0) {
		return null;
	}

	const randomSuffix = Math.random().toString(36).slice(2);
	const cookieFilePath = path.join(
		os.tmpdir(),
		`cookies-${Date.now()}-${randomSuffix}.txt`,
	);

	try {
		const lines = ["# Netscape HTTP Cookie File"];

		for (const cookie of cookies) {
			const flag = cookie.domain.startsWith(".") ? "TRUE" : "FALSE";
			const secure = cookie.secure ? "TRUE" : "FALSE";
			const expiration = cookie.expirationDate
				? Math.floor(cookie.expirationDate)
				: 0;

			lines.push(
				`${cookie.domain}\t${flag}\t${cookie.path}\t${secure}\t${expiration}\t${cookie.name}\t${cookie.value}`,
			);
		}

		await fs.writeFile(cookieFilePath, lines.join("\n"));
		return cookieFilePath;
	} catch (error) {
		logger.warn({ err: error }, "Failed to create cookie file");
		return null;
	}
}

function parseYtDlpOutput(result: unknown): YtDlpOutput[] {
	if (typeof result === "string") {
		return result
			.split("\n")
			.filter((line) => line.trim().length > 0)
			.reduce<YtDlpOutput[]>((acc, line) => {
				try {
					acc.push(JSON.parse(line));
				} catch (error) {
					logger.warn({ err: error, line }, "Failed to parse yt-dlp JSON line");
				}
				return acc;
			}, []);
	}

	if (Array.isArray(result)) {
		return result as YtDlpOutput[];
	}

	if (typeof result === "object" && result !== null) {
		return [result as YtDlpOutput];
	}

	throw new Error(`Unexpected yt-dlp output type: ${typeof result}`);
}

export class YtDlpDownloadBackend implements IDownloadBackend<YtDlpOutput> {
	getCapabilities(): DownloadBackendCapabilities {
		return localCapabilities;
	}

	async fetchMetadata(
		url: string,
		cookies?: unknown[],
		userAgent?: string,
	): Promise<YtDlpOutput | null> {
		const cookieFilePath = await createNetscapeCookieFile(
			(cookies as Cookie[] | undefined) ?? [],
		);

		try {
			const result = await youtubedl(url, {
				dumpSingleJson: true,
				noDownload: true,
				...(resolvedFfmpegPath && { ffmpegLocation: resolvedFfmpegPath }),
				...(userAgent && { userAgent }),
				...(cookieFilePath && { cookies: cookieFilePath }),
			} as never);

			return result as unknown as YtDlpOutput;
		} catch (error) {
			logger.warn({ err: error, url }, "Failed to fetch metadata with yt-dlp");
			return null;
		} finally {
			if (cookieFilePath) {
				fs.unlink(cookieFilePath).catch((error) =>
					logger.warn({ err: error }, "Failed to clean up cookie file"),
				);
			}
		}
	}

	async download(
		url: string,
		outputDir: string,
		cookies?: unknown[],
		userAgent?: string,
	): Promise<Array<{ filePath: string; metadata: YtDlpOutput }>> {
		await fs.mkdir(outputDir, { recursive: true });
		const cookieFilePath = await createNetscapeCookieFile(
			(cookies as Cookie[] | undefined) ?? [],
		);

		try {
			const result = await youtubedl(url, {
				noSimulate: true,
				printJson: true,
				paths: outputDir,
				output: "%(id)s.%(ext)s",
				format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
				mergeOutputFormat: "mp4",
				...(resolvedFfmpegPath && { ffmpegLocation: resolvedFfmpegPath }),
				...(userAgent && { userAgent }),
				...(cookieFilePath && { cookies: cookieFilePath }),
			} as never);

			return parseYtDlpOutput(result).map((metadata) => {
				let finalPath = metadata.filename || metadata._filename || "";
				if (finalPath && !path.isAbsolute(finalPath)) {
					finalPath = path.join(outputDir, finalPath);
				}
				return { filePath: finalPath, metadata };
			});
		} catch (error) {
			if (error instanceof Error && "stderr" in error) {
				logger.error(
					{ stderr: (error as Error & { stderr: string }).stderr },
					"yt-dlp execution failed",
				);
			} else {
				logger.error({ err: error }, "yt-dlp execution failed");
			}
			throw new Error(`yt-dlp failed: ${error}`);
		} finally {
			if (cookieFilePath) {
				fs.unlink(cookieFilePath).catch((error) =>
					logger.warn({ err: error }, "Failed to clean up cookie file"),
				);
			}
		}
	}
}

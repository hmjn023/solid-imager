import { execFile } from "node:child_process";
import { constants, createWriteStream } from "node:fs";
import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { crc32 } from "node:zlib";
import {
	ugoiraMetadataSchema,
	type UgoiraMetadata,
} from "@solid-imager/core/media";
import { openPromise, type Entry } from "yauzl";
import { resolveFfmpegPath } from "../utils/ffmpeg";

const MAX_FRAME_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const MAX_INPUT_PIXELS = 64_000_000;
const ENCODING_TIMEOUT_MS = 15 * 60 * 1000;
const execFileAsync = promisify(execFile);

function validateEntry(entry: Entry) {
	// Unix archives encode the file type in the upper 16 bits; DOS archives omit it.
	const fileType = (entry.externalFileAttributes >>> 16) & 0o170000;
	if (
		(fileType !== 0 && fileType !== 0o100000) ||
		(entry.externalFileAttributes & 0x10) !== 0 ||
		entry.fileName.includes("/") ||
		entry.fileName.includes("\\")
	) {
		throw new Error(
			"Ugoira archive entries must be regular files without paths",
		);
	}
	if (entry.isEncrypted()) {
		throw new Error("Encrypted ugoira archives are not supported");
	}
	if (
		!Number.isSafeInteger(entry.uncompressedSize) ||
		entry.uncompressedSize < 0 ||
		entry.uncompressedSize > MAX_FRAME_BYTES
	) {
		throw new Error("Ugoira frame exceeds the 64 MiB extraction limit");
	}
}

function validateImageHeader(file: string, header: Buffer) {
	const extension = path.extname(file).toLowerCase();
	const valid =
		extension === ".png"
			? header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
			: extension === ".gif"
				? ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString("ascii"))
				: header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
	if (!valid) throw new Error(`Invalid ugoira image: ${file}`);
}

async function extractFrames(
	zipPath: string,
	directory: string,
	frames: UgoiraMetadata["frames"],
) {
	const archive = await openPromise(zipPath, {
		autoClose: false,
		lazyEntries: true,
		strictFileNames: true,
		validateEntrySizes: true,
	});
	const requested = new Set(frames.map(({ file }) => file));
	const seen = new Set<string>();
	let declaredBytes = 0;
	let extractedBytes = 0;
	try {
		if (archive.entryCount > MAX_ENTRIES) {
			throw new Error("Ugoira archive exceeds the 10,000 entry limit");
		}
		for await (const entry of archive.eachEntry()) {
			validateEntry(entry);
			if (seen.has(entry.fileName))
				throw new Error("Duplicate ugoira archive entry");
			seen.add(entry.fileName);
			declaredBytes += entry.uncompressedSize;
			if (seen.size > MAX_ENTRIES || declaredBytes > MAX_ARCHIVE_BYTES) {
				throw new Error("Ugoira archive exceeds the extraction limits");
			}
			if (!requested.has(entry.fileName)) continue;
			const source = await archive.openReadStreamPromise(entry);
			let frameBytes = 0;
			let checksum = 0;
			let header = Buffer.alloc(0);
			const verifier = new Transform({
				transform(chunk: Buffer, _encoding, callback) {
					frameBytes += chunk.length;
					extractedBytes += chunk.length;
					if (
						frameBytes > MAX_FRAME_BYTES ||
						extractedBytes > MAX_ARCHIVE_BYTES
					) {
						callback(new Error("Ugoira archive exceeds the extraction limits"));
						return;
					}
					checksum = crc32(chunk, checksum);
					if (header.length < 8) {
						header = Buffer.concat([
							header,
							chunk.subarray(0, 8 - header.length),
						]);
					}
					callback(null, chunk);
				},
			});
			await pipeline(
				source,
				verifier,
				createWriteStream(path.join(directory, entry.fileName), {
					flags: "wx",
				}),
			);
			if (frameBytes !== entry.uncompressedSize || checksum !== entry.crc32) {
				throw new Error(`Corrupt ugoira frame: ${entry.fileName}`);
			}
			validateImageHeader(entry.fileName, header);
		}
		for (const file of requested) {
			if (!seen.has(file)) throw new Error(`Missing ugoira frame: ${file}`);
		}
	} finally {
		archive.close();
	}
}

async function getConcatFrames(
	directory: string,
	frames: UgoiraMetadata["frames"],
) {
	const formats = new Set(
		frames.map(({ file }) =>
			path.extname(file).toLowerCase().replace(".jpeg", ".jpg"),
		),
	);
	if (formats.size !== 1)
		throw new Error("Ugoira frames must use the same image format");
	const { default: sharp } = await import("sharp");
	let dimensions: { width: number; height: number } | undefined;
	for (const frame of frames) {
		const metadata = await sharp(path.join(directory, frame.file), {
			animated: false,
			limitInputPixels: MAX_INPUT_PIXELS,
		}).metadata();
		if (
			!metadata.width ||
			!metadata.height ||
			metadata.width * metadata.height > MAX_INPUT_PIXELS ||
			(dimensions &&
				(dimensions.width !== metadata.width ||
					dimensions.height !== metadata.height))
		) {
			throw new Error(
				"Ugoira frames must have matching dimensions within the pixel limit",
			);
		}
		if (!formats.has(".gif") && (metadata.pages ?? 1) > 1) {
			throw new Error("Ugoira image entries must contain a single frame");
		}
		dimensions = { width: metadata.width, height: metadata.height };
	}
	if (!formats.has(".gif")) return frames;
	// One metadata entry means one frame even if its GIF contains an embedded animation.
	let normalizedBytes = 0;
	const converted = [];
	for (const [index, frame] of frames.entries()) {
		const file = `${index}.png`;
		const destination = path.join(directory, file);
		await sharp(path.join(directory, frame.file), {
			animated: false,
			limitInputPixels: MAX_INPUT_PIXELS,
		})
			.png()
			.toFile(destination);
		const size = (await stat(destination)).size;
		normalizedBytes += size;
		if (size > MAX_FRAME_BYTES || normalizedBytes > MAX_ARCHIVE_BYTES) {
			throw new Error("Normalized ugoira frames exceed the extraction limits");
		}
		converted.push({ file, delay: frame.delay });
	}
	return converted;
}

/** Converts an ugoira ZIP without exposing extracted files or partial encodes to the library. */
export async function convertUgoiraToMp4(
	zipPath: string,
	outputPath: string,
	frames: UgoiraMetadata["frames"],
): Promise<void> {
	const validated = ugoiraMetadataSchema.parse({ frames }).frames;
	const ffmpeg = await resolveFfmpegPath();
	if (!ffmpeg)
		throw new Error("FFmpeg is required to convert ugoira animations");
	const directory = await mkdtemp(path.join(tmpdir(), "solid-imager-ugoira-"));
	try {
		await extractFrames(zipPath, directory, validated);
		const concatFrames = await getConcatFrames(directory, validated);
		const manifest = path.join(directory, "frames.ffconcat");
		await writeFile(
			manifest,
			"ffconcat version 1.0\n" +
				concatFrames
					.map(
						({ file, delay }) =>
							`file '${file}'\noption framerate 1000\nduration ${(delay / 1000).toFixed(3)}\n`,
					)
					.join(""),
		);
		const encoded = path.join(directory, "animation.mp4");
		const lastFrame = validated.at(-1);
		if (!lastFrame) throw new Error("Ugoira animation has no frames");
		const duration =
			validated.reduce((total, frame) => total + frame.delay, 0) / 1000;
		await execFileAsync(
			ffmpeg,
			[
				"-hide_banner",
				"-loglevel",
				"error",
				"-nostdin",
				"-xerror",
				"-threads",
				"2",
				"-filter_threads",
				"1",
				"-protocol_whitelist",
				"file",
				"-format_whitelist",
				"concat,image2,jpeg_pipe,png_pipe",
				"-f",
				"concat",
				"-safe",
				"0",
				"-i",
				manifest,
				"-map",
				"0:v:0",
				"-an",
				"-sn",
				"-dn",
				"-map_metadata",
				"-1",
				"-vf",
				"pad=ceil(iw/2)*2:ceil(ih/2)*2",
				"-c:v",
				"libx264",
				"-preset",
				"fast",
				"-crf",
				"18",
				"-pix_fmt",
				"yuv420p",
				"-threads",
				"2",
				"-bf",
				"0",
				"-fps_mode",
				"passthrough",
				"-enc_time_base",
				"1:1000",
				// Concat specifies the next frame's PTS, but the last packet needs its own duration.
				// Disabling B-frames keeps packet order equal to metadata order; no duplicate sentinel frame.
				"-bsf:v",
				`setts=duration=if(eq(N\\,${validated.length - 1})\\,${lastFrame.delay}/1000/TB\\,DURATION)`,
				"-video_track_timescale",
				"1000",
				"-t",
				duration.toFixed(3),
				"-movflags",
				"+faststart",
				"-f",
				"mp4",
				encoded,
			],
			{
				timeout: ENCODING_TIMEOUT_MS,
				killSignal: "SIGKILL",
				maxBuffer: 1024 * 1024,
				windowsHide: true,
			},
		);
		if ((await stat(encoded)).size === 0)
			throw new Error("FFmpeg produced an empty ugoira video");
		await copyFile(encoded, outputPath, constants.COPYFILE_EXCL);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

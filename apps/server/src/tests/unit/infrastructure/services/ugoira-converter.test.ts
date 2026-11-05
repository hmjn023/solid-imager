import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
	chmod,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { crc32, deflateRawSync } from "node:zlib";
import staticFfmpeg from "ffmpeg-static";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertUgoiraToMp4 } from "~/infrastructure/services/ugoira-converter";
import { resolveFfmpegPath } from "~/infrastructure/utils/ffmpeg";

vi.mock("~/infrastructure/utils/ffmpeg", () => ({
	resolveFfmpegPath: vi.fn(),
}));

interface ZipFixtureEntry {
	name: string;
	data: Buffer;
	attributes?: number;
	encrypted?: boolean;
	checksum?: number;
	uncompressedSize?: number;
	deflated?: boolean;
}

// Small stored/deflated ZIPs let tests represent malformed entries without an external ZIP command.
function createZip(entries: ZipFixtureEntry[]): Buffer {
	const locals: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const entry of entries) {
		const name = Buffer.from(entry.name);
		const data = entry.deflated ? deflateRawSync(entry.data) : entry.data;
		const checksum = entry.checksum ?? crc32(entry.data);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(entry.encrypted ? 1 : 0, 6);
		local.writeUInt16LE(entry.deflated ? 8 : 0, 8);
		local.writeUInt32LE(checksum, 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(entry.uncompressedSize ?? entry.data.length, 22);
		local.writeUInt16LE(name.length, 26);
		locals.push(local, name, data);
		const record = Buffer.alloc(46);
		record.writeUInt32LE(0x02014b50, 0);
		record.writeUInt16LE(0x0314, 4);
		record.writeUInt16LE(20, 6);
		record.writeUInt16LE(entry.encrypted ? 1 : 0, 8);
		record.writeUInt16LE(entry.deflated ? 8 : 0, 10);
		record.writeUInt32LE(checksum, 16);
		record.writeUInt32LE(data.length, 20);
		record.writeUInt32LE(entry.uncompressedSize ?? entry.data.length, 24);
		record.writeUInt16LE(name.length, 28);
		record.writeUInt32LE(entry.attributes ?? (0o100600 << 16) >>> 0, 38);
		record.writeUInt32LE(offset, 42);
		central.push(record, name);
		offset += local.length + name.length + data.length;
	}
	const records = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(records.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, records, end]);
}

const execFileAsync = promisify(execFile);
const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const frame = { file: "000000.png", delay: 125 };
let directory: string;
let archivePath: string;
let outputPath: string;
let realEncoderAvailable = Boolean(staticFfmpeg && existsSync(staticFfmpeg));
try {
	execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
} catch {
	realEncoderAvailable = false;
}

beforeEach(async () => {
	directory = await mkdtemp(path.join(tmpdir(), "ugoira-converter-test-"));
	vi.stubEnv("TMPDIR", directory);
	archivePath = path.join(directory, "frames.zip");
	outputPath = path.join(directory, "result.mp4");
	vi.mocked(resolveFfmpegPath).mockResolvedValue(
		staticFfmpeg ?? "/missing-ffmpeg",
	);
});

afterEach(async () => {
	try {
		expect(
			(await readdir(directory)).filter((name) =>
				name.startsWith("solid-imager-ugoira-"),
			),
		).toEqual([]);
	} finally {
		vi.unstubAllEnvs();
		await rm(directory, { recursive: true, force: true });
	}
});

async function expectRejectedZip(entries: ZipFixtureEntry[], message: RegExp) {
	await writeFile(archivePath, createZip(entries));
	await expect(
		convertUgoiraToMp4(archivePath, outputPath, [frame]),
	).rejects.toThrow(message);
	expect(existsSync(outputPath)).toBe(false);
}

describe("ugoira archive validation and cleanup", () => {
	it("rejects invalid ZIP data without leaving temporary files", async () => {
		await writeFile(archivePath, "not a ZIP");
		await expect(
			convertUgoiraToMp4(archivePath, outputPath, [frame]),
		).rejects.toThrow();
	});

	it.each([
		"../000000.png",
		"/000000.png",
		"folder/000000.png",
		"folder\\000000.png",
	])("rejects archive paths: %s", async (name) => {
		await expectRejectedZip(
			[{ name, data: header }],
			/path|relative|absolute|backslash|invalid characters/i,
		);
	});

	it("rejects symlinks even when they have a requested frame name", async () => {
		await expectRejectedZip(
			[{ name: frame.file, data: header, attributes: (0o120777 << 16) >>> 0 }],
			/regular files/,
		);
	});

	it("rejects encrypted frames", async () => {
		await expectRejectedZip(
			[{ name: frame.file, data: header, encrypted: true, deflated: true }],
			/encrypted/i,
		);
	});

	it("rejects duplicate archive entries", async () => {
		await expectRejectedZip(
			[
				{ name: frame.file, data: header },
				{ name: frame.file, data: header },
			],
			/Duplicate/,
		);
	});

	it("rejects missing frames", async () => {
		await expectRejectedZip([{ name: "000001.png", data: header }], /Missing/);
	});

	it("checks the CRC instead of accepting same-length corrupted frame data", async () => {
		await expectRejectedZip(
			[{ name: frame.file, data: header, checksum: 123 }],
			/Corrupt|CRC/i,
		);
	});

	it("rejects non-image content even when its filename has an image extension", async () => {
		await expectRejectedZip(
			[
				{
					name: frame.file,
					data: Buffer.from("ffconcat version 1.0\nfile '/tmp/private.png'"),
				},
			],
			/Invalid ugoira image/,
		);
	});

	it("bounds each frame by its declared uncompressed size before extraction", async () => {
		await expectRejectedZip(
			[
				{
					name: frame.file,
					data: header,
					deflated: true,
					uncompressedSize: 64 * 1024 * 1024 + 1,
				},
			],
			/64 MiB/,
		);
	});

	it("bounds total declared uncompressed bytes, including unlisted entries", async () => {
		await expectRejectedZip(
			Array.from({ length: 17 }, (_, index) => ({
				name: `${index + 1}.png`,
				data: header,
				deflated: true,
				uncompressedSize: 64 * 1024 * 1024,
			})),
			/extraction limits/,
		);
	});

	it("rejects streams that expand beyond their declared size", async () => {
		await expectRejectedZip(
			[{ name: frame.file, data: header, deflated: true, uncompressedSize: 1 }],
			/bytes|size/i,
		);
	});

	it("rejects too many ZIP entries before extraction", async () => {
		await expectRejectedZip(
			Array.from({ length: 10_001 }, (_, index) => ({
				name: `${index}.png`,
				data: header,
			})),
			/10,000 entry limit/,
		);
	});

	it("validates metadata before creating a temporary directory", async () => {
		await expect(
			convertUgoiraToMp4(archivePath, outputPath, [
				{ file: "../000000.png", delay: 125 },
			]),
		).rejects.toThrow();
		await expect(
			convertUgoiraToMp4(archivePath, outputPath, [{ ...frame, delay: 0 }]),
		).rejects.toThrow();
	});

	it("cleans up partial FFmpeg output after encoder failure", async () => {
		const failingEncoder = path.join(directory, "failing-encoder.cjs");
		await writeFile(
			failingEncoder,
			`#!${process.execPath}\nrequire('node:fs').writeFileSync(process.argv.at(-1), 'partial mp4'); process.exit(1);\n`,
		);
		await chmod(failingEncoder, 0o700);
		vi.mocked(resolveFfmpegPath).mockResolvedValue(failingEncoder);
		const data = await sharp({
			create: { width: 8, height: 6, channels: 3, background: "red" },
		})
			.png()
			.toBuffer();
		await expectRejectedZip([{ name: frame.file, data }], /Command failed/);
	});

	it("rejects inconsistent image dimensions before encoding", async () => {
		const entries = await Promise.all(
			[8, 10].map(async (width, index) => ({
				name: `${index}.png`,
				data: await sharp({
					create: { width, height: 6, channels: 3, background: "red" },
				})
					.png()
					.toBuffer(),
			})),
		);
		await writeFile(archivePath, createZip(entries));
		await expect(
			convertUgoiraToMp4(
				archivePath,
				outputPath,
				entries.map(({ name }) => ({ file: name, delay: 125 })),
			),
		).rejects.toThrow(/matching dimensions/);
		expect(existsSync(outputPath)).toBe(false);
	});

	it("rejects small PNG files declaring excessive decoded pixel dimensions", async () => {
		const data = await sharp({
			create: { width: 8, height: 6, channels: 3, background: "red" },
		})
			.png()
			.toBuffer();
		data.writeUInt32BE(100_000, 16);
		data.writeUInt32BE(100_000, 20);
		data.writeUInt32BE(crc32(data.subarray(12, 29)), 29);
		await expectRejectedZip([{ name: frame.file, data }], /pixel limit/i);
	});
});

describe.skipIf(!realEncoderAvailable)("ugoira real FFmpeg conversion", () => {
	it.each([[57, 123, 241], [137], [1, 999, 1]])(
		"preserves order, variable timing, final duration and even-size padding: %j",
		async (...delays) => {
			const colors = ["red", "lime", "blue"];
			const entries = await Promise.all(
				delays.map(async (_, index) => ({
					name: `${index.toString().padStart(6, "0")}.png`,
					data: await sharp({
						create: {
							width: 7,
							height: 5,
							channels: 3,
							background: colors[index],
						},
					})
						.png()
						.toBuffer(),
				})),
			);
			await writeFile(archivePath, createZip([...entries].reverse()));
			const frames = entries.map(({ name }, index) => ({
				file: name,
				delay: delays[index],
			}));
			await convertUgoiraToMp4(archivePath, outputPath, frames);
			const { stdout } = await execFileAsync("ffprobe", [
				"-v",
				"error",
				"-select_streams",
				"v:0",
				"-show_entries",
				"stream=codec_name,width,height,pix_fmt,duration,nb_frames:packet=pts_time,duration_time",
				"-of",
				"json",
				outputPath,
			]);
			const probe = JSON.parse(stdout);
			expect(probe.streams).toHaveLength(1);
			expect(probe.streams[0]).toMatchObject({
				codec_name: "h264",
				width: 8,
				height: 6,
				pix_fmt: "yuv420p",
				nb_frames: String(frames.length),
			});
			expect(Number(probe.streams[0].duration)).toBeCloseTo(
				delays.reduce((sum, delay) => sum + delay, 0) / 1000,
				6,
			);
			expect(probe.packets).toHaveLength(frames.length);
			let timestamp = 0;
			for (const [index, delay] of delays.entries()) {
				expect(Number(probe.packets[index].pts_time)).toBeCloseTo(
					timestamp / 1000,
					6,
				);
				expect(Number(probe.packets[index].duration_time)).toBeCloseTo(
					delay / 1000,
					6,
				);
				timestamp += delay;
			}
			const { stdout: decoded } = await execFileAsync(
				staticFfmpeg ?? "ffmpeg",
				[
					"-v",
					"error",
					"-i",
					outputPath,
					"-fps_mode",
					"passthrough",
					"-threads",
					"1",
					"-f",
					"rawvideo",
					"-pix_fmt",
					"rgb24",
					"pipe:1",
				],
				{ encoding: "buffer" },
			);
			expect(decoded.length).toBe(frames.length * 8 * 6 * 3);
			for (let index = 0; index < frames.length; index++) {
				const pixel = decoded.subarray(
					index * 8 * 6 * 3 + (2 * 8 + 2) * 3,
					index * 8 * 6 * 3 + (2 * 8 + 2) * 3 + 3,
				);
				expect(pixel[index]).toBeGreaterThan(200);
				for (let channel = 0; channel < 3; channel++) {
					if (channel !== index) expect(pixel[channel]).toBeLessThan(50);
				}
			}
		},
		30_000,
	);

	it("normalizes GIF metadata entries to one PNG frame each", async () => {
		const data = await sharp({
			create: { width: 8, height: 6, channels: 3, background: "red" },
		})
			.gif()
			.toBuffer();
		await writeFile(archivePath, createZip([{ name: "000000.gif", data }]));
		await convertUgoiraToMp4(archivePath, outputPath, [
			{ file: "000000.gif", delay: 125 },
		]);
		const { stdout } = await execFileAsync("ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"stream=duration,nb_frames",
			"-of",
			"json",
			outputPath,
		]);
		expect(JSON.parse(stdout).streams[0]).toMatchObject({
			duration: "0.125000",
			nb_frames: "1",
		});
	});

	it("does not replace an existing output", async () => {
		const data = await sharp({
			create: { width: 8, height: 6, channels: 3, background: "red" },
		})
			.png()
			.toBuffer();
		await writeFile(archivePath, createZip([{ name: frame.file, data }]));
		await writeFile(outputPath, "existing video");
		await expect(
			convertUgoiraToMp4(archivePath, outputPath, [frame]),
		).rejects.toThrow(/EEXIST/);
		expect(await readFile(outputPath, "utf8")).toBe("existing video");
	});
});

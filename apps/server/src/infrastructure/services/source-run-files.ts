import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";

const MaxLineBytes = 8 * 1024 * 1024;

/** Bounded byte reader. Offsets include newlines and remain valid for UTF-8 input. */
export async function* sourceInputLines(
	input: string,
	offset = 0,
	signal?: AbortSignal,
) {
	const stream = createReadStream(input, {
		start: offset,
		highWaterMark: 64 * 1024,
		signal,
	});
	let pending: Buffer = Buffer.alloc(0);
	try {
		for await (const chunk of stream) {
			if (!Buffer.isBuffer(chunk))
				throw new Error("Unexpected input stream encoding");
			pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
			let end = pending.indexOf(10);
			while (end !== -1) {
				if (end > MaxLineBytes)
					throw new Error("Source input line exceeds 8 MiB");
				offset += end + 1;
				yield { text: pending.subarray(0, end).toString("utf8"), offset };
				pending = pending.subarray(end + 1);
				end = pending.indexOf(10);
			}
			if (pending.length > MaxLineBytes)
				throw new Error("Source input line exceeds 8 MiB");
		}
		if (pending.length)
			yield { text: pending.toString("utf8"), offset: offset + pending.length };
	} finally {
		stream.destroy();
	}
}

export async function fingerprintSourceInput(
	input: string,
	signal?: AbortSignal,
) {
	const hash = createHash("sha256");
	let size = 0;
	const stream = createReadStream(input, { highWaterMark: 64 * 1024, signal });
	try {
		for await (const chunk of stream) {
			if (!Buffer.isBuffer(chunk))
				throw new Error("Unexpected input stream encoding");
			hash.update(chunk);
			size += chunk.length;
		}
	} finally {
		stream.destroy();
	}
	return { inputDigest: hash.digest("hex"), inputSize: size };
}

export function validateSourceRelativePath(input: string): string {
	const relative = input.replace(/^\.\//, "");
	let hasControl = false;
	for (let index = 0; index < relative.length; index++) {
		const code = relative.charCodeAt(index);
		if (code < 32 || code === 127) {
			hasControl = true;
			break;
		}
	}
	if (
		!relative ||
		relative.includes("\\") ||
		hasControl ||
		path.posix.isAbsolute(relative) ||
		relative.split("/").some((part) => part === "..")
	)
		throw new Error("Unsafe source archive path");
	return relative;
}

async function runTar(
	args: string[],
	signal: AbortSignal,
	line?: (text: string) => Promise<void>,
) {
	signal.throwIfAborted();
	const child = spawn("tar", args, {
		stdio: ["ignore", "pipe", "pipe"],
		// GNU tar then emits non-ASCII path bytes as octal escapes consistently.
		env: { ...process.env, LC_ALL: "C" },
		signal,
	});
	const done = new Promise<void>((resolve, reject) => {
		child.once("error", reject);
		child.once("close", (code) =>
			code === 0
				? resolve()
				: reject(new Error("Source archive command failed")),
		);
	});
	// Consume stderr without retaining arbitrary archive-controlled output.
	child.stderr.resume();
	void done.catch(() => {});
	try {
		let pending = "";
		for await (const chunk of child.stdout) {
			pending += String(chunk);
			let end = pending.indexOf("\n");
			while (end !== -1) {
				if (end > MaxLineBytes) throw new Error("Archive entry exceeds limit");
				await line?.(pending.slice(0, end));
				pending = pending.slice(end + 1);
				end = pending.indexOf("\n");
			}
			if (Buffer.byteLength(pending) > MaxLineBytes)
				throw new Error("Archive entry exceeds limit");
		}
		if (pending) await line?.(pending);
		await done;
	} catch (error) {
		child.kill("SIGKILL");
		await done.catch(() => {});
		throw error;
	}
}

/** Decode GNU tar's display escaping before validating the actual UTF-8 path. */
function decodeTarPath(value: string): string {
	const bytes: number[] = [];
	const escapes: Record<string, number> = {
		a: 7,
		b: 8,
		f: 12,
		n: 10,
		r: 13,
		t: 9,
		v: 11,
		"\\": 92,
	};
	for (let index = 0; index < value.length; index++) {
		if (value[index] !== "\\") {
			bytes.push(value.charCodeAt(index));
			continue;
		}
		const octal = value.slice(index + 1, index + 4);
		if (/^[0-7]{3}$/.test(octal)) {
			bytes.push(Number.parseInt(octal, 8));
			index += 3;
		} else {
			const escaped = escapes[value[++index] ?? ""];
			if (escaped === undefined)
				throw new Error("Invalid source archive path escape");
			bytes.push(escaped);
		}
	}
	return new TextDecoder("utf-8", { fatal: true }).decode(
		new Uint8Array(bytes),
	);
}

/** Validate all entry types before extracting; disk manifest preserves archive order on retry. */
export async function extractSourceTar(
	input: string,
	staging: string,
	signal: AbortSignal,
) {
	await fs.mkdir(staging, { recursive: true });
	const manifest = path.join(staging, "images.manifest");
	const output = createWriteStream(manifest);
	output.on("error", () => {});
	let dumps = 0;
	try {
		await runTar(
			["--list", "--verbose", "--file", input, "--quoting-style=escape"],
			signal,
			async (line) => {
				if (!line.startsWith("-") && !line.startsWith("d"))
					throw new Error(
						"Source archives may contain only regular files and directories",
					);
			},
		);
		await runTar(
			["--list", "--file", input, "--quoting-style=escape"],
			signal,
			async (line) => {
				const entry = validateSourceRelativePath(decodeTarPath(line));
				if (entry === "dump.ndjson") {
					dumps++;
					return;
				}
				if (entry === "images/" || entry === "images") return;
				if (!entry.startsWith("images/"))
					throw new Error("Unexpected source archive entry");
				if (!entry.endsWith("/")) {
					if (!output.write(entry + "\n")) await once(output, "drain");
				}
			},
		);
		if (dumps !== 1)
			throw new Error("Source archive requires exactly one dump.ndjson");
		await new Promise<void>((resolve, reject) => {
			output.once("error", reject);
			output.end(resolve);
		});
		await runTar(
			[
				"--extract",
				"--file",
				input,
				"--directory",
				staging,
				"--no-same-owner",
				"--no-same-permissions",
				"--delay-directory-restore",
				"--restrict",
			],
			signal,
		);
		return { manifest, dump: path.join(staging, "dump.ndjson") };
	} finally {
		output.destroy();
	}
}

/** Reject symlink parents as well as traversal; publish uses an attempt-owned temporary file. */
export async function stageSourceImage(
	root: string,
	relative: string,
	input: string,
	suffix: string,
	signal: AbortSignal,
) {
	const parts = validateSourceRelativePath(relative).split("/").filter(Boolean);
	let parent = path.resolve(root);
	for (const part of parts.slice(0, -1)) {
		parent = path.join(parent, part);
		await fs.mkdir(parent).catch((error: unknown) => {
			if (
				!(
					error &&
					typeof error === "object" &&
					"code" in error &&
					error.code === "EEXIST"
				)
			)
				throw error;
		});
		const stat = await fs.lstat(parent);
		if (!stat.isDirectory() || stat.isSymbolicLink())
			throw new Error("Unsafe restore destination");
	}
	const target = path.join(parent, parts.at(-1) ?? "");
	const partial = target + "." + suffix + ".partial";
	try {
		await pipeline(
			createReadStream(input),
			createWriteStream(partial, { flags: "wx" }),
			{ signal },
		);
	} catch (error) {
		await fs.rm(partial, { force: true });
		throw error;
	}
	return { target, partial };
}

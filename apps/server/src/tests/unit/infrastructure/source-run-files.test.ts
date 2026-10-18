import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
	sourceInputLines,
	fingerprintSourceInput,
	validateSourceRelativePath,
	stageSourceImage,
	extractSourceTar,
} from "~/infrastructure/services/source-run-files";
describe("bounded source input", () => {
	let root: string;
	beforeEach(async () => {
		root = await fs.mkdtemp(path.join(os.tmpdir(), "source-input-"));
	});
	afterEach(async () => {
		vi.unstubAllEnvs();
		await fs.rm(root, { recursive: true, force: true });
	});
	const archive = async (name: string) => {
		const input = path.join(root, "input");
		await fs.mkdir(path.join(input, "images"), { recursive: true });
		await fs.writeFile(path.join(input, "dump.ndjson"), "{}\n");
		await fs.writeFile(path.join(input, "images", name), "image fixture");
		const tar = path.join(root, "input.tar");
		execFileSync("tar", ["-cf", tar, "-C", input, "dump.ndjson", "images"]);
		return tar;
	};
	it.each(["C", "C.UTF-8"])(
		"restores UTF-8 archive paths under %s",
		async (locale) => {
			vi.stubEnv("LC_ALL", locale);
			const name = "日本語 🐱 'quoted'.png";
			const tar = await archive(name);
			const staging = path.join(root, "staging");
			const extracted = await extractSourceTar(
				tar,
				staging,
				new AbortController().signal,
			);
			expect(await fs.readFile(extracted.manifest, "utf8")).toBe(
				"images/" + name + "\n",
			);
			expect(
				await fs.readFile(path.join(staging, "images", name), "utf8"),
			).toBe("image fixture");
		},
	);
	it.each(["line\nfeed.png", "back\\slash.png", "tab\tname.png"])(
		"rejects unsafe actual archive path %j after decoding",
		async (name) => {
			const tar = await archive(name);
			const staging = path.join(root, "staging");
			await expect(
				extractSourceTar(tar, staging, new AbortController().signal),
			).rejects.toThrow("Unsafe source archive path");
			await expect(
				fs.access(path.join(staging, "dump.ndjson")),
			).rejects.toThrow();
		},
	);
	it("resumes at byte boundaries with multibyte text and a final unterminated line", async () => {
		const input = path.join(root, "input");
		await fs.writeFile(input, "日本語\nlast");
		const lines = [];
		for await (const line of sourceInputLines(input)) lines.push(line);
		expect(lines).toEqual([
			{ text: "日本語", offset: 10 },
			{ text: "last", offset: 14 },
		]);
		const resumed = [];
		for await (const line of sourceInputLines(input, 10)) resumed.push(line);
		expect(resumed).toEqual([lines[1]]);
	});
	it("rejects an oversized line with an 8 MiB bound", async () => {
		const input = path.join(root, "input");
		await fs.writeFile(input, Buffer.alloc(8 * 1024 * 1024 + 1, 65));
		await expect(async () => {
			for await (const _line of sourceInputLines(input)) {
			}
		}).rejects.toThrow("exceeds 8 MiB");
	});
	it("detects a changed retained input without loading it whole", async () => {
		const input = path.join(root, "input");
		await fs.writeFile(input, "first");
		const first = await fingerprintSourceInput(input);
		await fs.writeFile(input, "other");
		expect(await fingerprintSourceInput(input)).not.toEqual(first);
	});
	it("rejects traversal, absolute paths and archive control escapes", () => {
		for (const value of [
			"../escape",
			"/absolute",
			"images/../../escape",
			"images/\\n",
			"images/line\nfeed",
		])
			expect(() => validateSourceRelativePath(value)).toThrow();
		expect(validateSourceRelativePath("images/日本語.png")).toBe(
			"images/日本語.png",
		);
	});
	it("refuses a symlink directory in the restore destination", async () => {
		const input = path.join(root, "input"),
			outside = path.join(root, "outside"),
			target = path.join(root, "target");
		await fs.writeFile(input, "bytes");
		await fs.mkdir(outside);
		await fs.mkdir(target);
		await fs.symlink(outside, path.join(target, "link"));
		await expect(
			stageSourceImage(
				target,
				"link/escape.png",
				input,
				"attempt",
				new AbortController().signal,
			),
		).rejects.toThrow("Unsafe restore destination");
		expect(await fs.readdir(outside)).toEqual([]);
	});
});

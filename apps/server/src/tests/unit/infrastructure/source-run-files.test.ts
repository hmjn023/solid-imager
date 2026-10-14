import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
	sourceInputLines,
	fingerprintSourceInput,
	validateSourceRelativePath,
	stageSourceImage,
} from "~/infrastructure/services/source-run-files";
describe("bounded source input", () => {
	let root: string;
	beforeEach(async () => {
		root = await fs.mkdtemp(path.join(os.tmpdir(), "source-input-"));
	});
	afterEach(async () => {
		await fs.rm(root, { recursive: true, force: true });
	});
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

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

let directory: string;
let source: string;
let target: string;
beforeEach(async () => {
	directory = await fs.mkdtemp(
		path.join(os.tmpdir(), "si-storage-copy-recovery-"),
	);
	source = path.join(directory, "image.png");
	target = path.join(directory, "target");
	await fs.mkdir(target);
	await fs.writeFile(source, "fixture bytes");
});
afterEach(async () => {
	vi.restoreAllMocks();
	await fs.rm(directory, { recursive: true, force: true });
});

describe("storage copy metadata failure", () => {
	it("propagates an unsafe-retry marker when metadata extraction and physical cleanup both fail", async () => {
		vi.spyOn(ServerMediaStorage, "getFileMetadata").mockRejectedValueOnce(
			new Error("metadata failed"),
		);
		vi.spyOn(fs, "unlink").mockRejectedValueOnce(
			new Error(`cleanup failed ${directory}`),
		);
		const error = await ServerMediaStorage.copyFile(source, target, {}).catch(
			(cause: unknown) => cause,
		);
		expect(error).toMatchObject({ name: "UnreconciledStorageError" });
		expect(error instanceof Error && error.message).not.toContain(directory);
		expect(await fs.readFile(path.join(target, "image.png"), "utf8")).toBe(
			"fixture bytes",
		);
	});
	it("retains the metadata error after successful cleanup removes the copied file", async () => {
		const metadataError = new Error("metadata failed");
		vi.spyOn(ServerMediaStorage, "getFileMetadata").mockRejectedValueOnce(
			metadataError,
		);
		await expect(ServerMediaStorage.copyFile(source, target, {})).rejects.toBe(
			metadataError,
		);
		await expect(fs.readFile(path.join(target, "image.png"))).rejects.toThrow();
	});
});

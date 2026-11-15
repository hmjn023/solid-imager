import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { NativeInferenceProcess } from "~/infrastructure/ai/native-inference-process";

const fixture = vi.hoisted(() => ({ modulePath: "" }));
vi.mock("~/infrastructure/ai/dghs-imgutils-loader", () => ({
	resolveDghsImgutilsPath: () => fixture.modulePath,
}));

it("returns segmented PNG bytes in the API's base64 encoding from the child process", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "segmentation-worker-"));
	const worker = new NativeInferenceProcess();
	try {
		fixture.modulePath = path.join(directory, "native.cjs");
		await writeFile(
			fixture.modulePath,
			[
				"exports.segmentRgbaWithIsnetis = () => [137, 80, 78, 71, 0, 128, 255];",
				"exports.offloadInferenceSessions = () => {};",
			].join("\n"),
		);
		await expect(worker.call("segmentPngBase64", "input.png")).resolves.toBe(
			"iVBORwCA/w==",
		);
	} finally {
		await worker.offload();
		await rm(directory, { recursive: true, force: true });
	}
});

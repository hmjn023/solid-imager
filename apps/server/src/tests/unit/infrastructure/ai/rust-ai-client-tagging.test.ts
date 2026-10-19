import { describe, expect, it, vi } from "vitest";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";
import { getTaggingTaskRevision } from "@solid-imager/application/services/tagging-task-service";
import { getCcipTaskRevision } from "@solid-imager/application/services/ccip-vector-service";
import { canReuseAiResult } from "@solid-imager/application/services/ai-media-task-service";
import {
	TAGGING_MODEL_VERSION,
	CCIP_MODEL_VERSION,
	type MediaProcessingInput,
} from "@solid-imager/core/domain/processing/schemas";

vi.mock("~/infrastructure/ai/dghs-imgutils-loader", () => ({
	loadDghsImgutils: () => {
		throw new Error("native runtime unavailable");
	},
}));

describe("AI identity when native inference is unavailable", () => {
	it("can claim a task before inference reports the native loader failure", async () => {
		const client = new RustAiClient({ provider: "cpu" });
		expect(client.getTaggingSettings()).toMatchObject({
			model: "pixai",
			modelVersion: TAGGING_MODEL_VERSION,
			runtimeVersion: "unknown",
			endpoint: "",
		});
		await expect(client.tagImageByPath("/fixture/image.png")).rejects.toThrow(
			"native runtime unavailable",
		);
	});
	it("exposes CCIP identity even when loading the native runtime fails", async () => {
		const client = new RustAiClient({ provider: "cpu" });
		expect(client.getCcipSettings()).toMatchObject({
			model: "ccip-caformer-24-randaug-pruned",
			modelVersion: CCIP_MODEL_VERSION,
			runtimeVersion: "unknown",
			embeddingVersion: 1,
			dimensions: 768,
			endpoint: "",
		});
		await expect(
			client.extractCcipFeatureByPath("/fixture/image.png"),
		).rejects.toThrow("native runtime unavailable");
	});
	it("keeps result identities and reuse across local, remote and execution configuration changes", () => {
		const client = new RustAiClient({ provider: "cpu" });
		const input: MediaProcessingInput = {
			mediaId: "media",
			mediaSourceId: "source",
			mediaType: "image",
			sourcePath: "/fixture",
			filePath: "image.png",
			modifiedAt: new Date("2026-01-01"),
			fileSize: 100,
		};
		const taggingRevision = getTaggingTaskRevision(
			input,
			client.getTaggingSettings(),
		);
		const ccipRevision = getCcipTaskRevision(input, client.getCcipSettings());
		for (const baseUrl of [
			"https://ai-a.example",
			"https://ai-b.example",
			"",
		]) {
			client.updateConfig({
				baseUrl,
				timeoutMs: 60_000,
				provider: "cuda",
				device: "1",
			});
			expect(getTaggingTaskRevision(input, client.getTaggingSettings())).toBe(
				taggingRevision,
			);
			expect(getCcipTaskRevision(input, client.getCcipSettings())).toBe(
				ccipRevision,
			);
			expect(canReuseAiResult(client.getTaggingSettings())).toBe(true);
			expect(canReuseAiResult(client.getCcipSettings())).toBe(true);
		}
	});
});

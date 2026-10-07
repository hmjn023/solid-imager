import { describe, expect, it, vi } from "vitest";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";

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
			modelVersion: "v0.9",
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
			modelVersion: "native-v1",
			runtimeVersion: "unknown",
			embeddingVersion: 1,
			dimensions: 768,
			endpoint: "",
		});
		await expect(
			client.extractCcipFeatureByPath("/fixture/image.png"),
		).rejects.toThrow("native runtime unavailable");
	});
});

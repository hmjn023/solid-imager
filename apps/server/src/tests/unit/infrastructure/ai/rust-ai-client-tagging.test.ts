import { describe, expect, it, vi } from "vitest";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";

vi.mock("~/infrastructure/ai/dghs-imgutils-loader", () => ({
	loadDghsImgutils: () => {
		throw new Error("native runtime unavailable");
	},
}));

describe("tagging identity when native inference is unavailable", () => {
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
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";

const mocks = vi.hoisted(() => ({
	encode: vi.fn(),
	tag: vi.fn(),
	remoteImage: vi.fn(),
	remoteText: vi.fn(),
	createClient: vi.fn(),
}));
vi.mock("~/infrastructure/ai/embedding-gemma-worker", () => ({
	embeddingGemmaWorker: { encode: mocks.encode },
}));
vi.mock("~/infrastructure/ai/dghs-imgutils-loader", () => ({
	loadDghsImgutils: () => ({ getPixaiTags: mocks.tag }),
}));
vi.mock("@solid-imager/client", () => ({ createClient: mocks.createClient }));
const vector = Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0));

describe("RustAiClient shared embedding configuration", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.encode.mockResolvedValue(vector);
		mocks.tag.mockResolvedValue({
			general: {},
			character: {},
			ips: [],
			ipsMapping: {},
		});
		mocks.remoteImage.mockResolvedValue({ feature: vector });
		mocks.remoteText.mockResolvedValue({ feature: vector });
		mocks.createClient.mockReturnValue({
			ai: {
				embeddingImage: mocks.remoteImage,
				embeddingText: mocks.remoteText,
			},
		});
	});

	it("uses the same GPU/device settings as tagging, and applies runtime configuration changes", async () => {
		const client = new RustAiClient({ provider: "cuda", device: " 1 " });
		await client.extractImageEmbeddingByPath("/image.png");
		await client.extractTextEmbedding(" 海辺 ");
		await client.tagImageByPath("/image.png");
		expect(mocks.encode).toHaveBeenNthCalledWith(1, "image", "/image.png", {
			provider: "cuda",
			device: "1",
		});
		expect(mocks.encode).toHaveBeenNthCalledWith(2, "text", "海辺", {
			provider: "cuda",
			device: "1",
		});
		expect(mocks.tag).toHaveBeenCalledWith("/image.png", undefined, undefined, {
			provider: "cuda",
			device: "1",
		});
		client.updateConfig({
			provider: "intel_gpu",
			device: "GPU.0",
			baseUrl: "",
			timeoutMs: 120000,
		});
		await client.extractTextEmbedding("海辺");
		expect(mocks.encode).toHaveBeenLastCalledWith("text", "海辺", {
			provider: "intel_gpu",
			device: "GPU.0",
		});
		client.updateConfig({ provider: "cpu", baseUrl: "", timeoutMs: 120000 });
		await client.extractImageEmbeddingByPath("/image.png");
		expect(mocks.encode).toHaveBeenLastCalledWith("image", "/image.png", {
			provider: "cpu",
		});
	});

	it("uses the shared remote client for both embeddings and switches back to local inference", async () => {
		const client = new RustAiClient({
			provider: "cuda",
			baseUrl: "http://ai.example",
			timeoutMs: 45000,
		});
		await expect(client.extractTextEmbedding("海辺")).resolves.toEqual(vector);
		await expect(
			client.extractImageEmbedding(new Uint8Array([137, 80, 78, 71]).buffer),
		).resolves.toEqual(vector);
		expect(mocks.remoteText).toHaveBeenCalledWith({ text: "海辺" });
		expect(mocks.remoteImage).toHaveBeenCalledWith({ file: expect.any(File) });
		expect(mocks.encode).not.toHaveBeenCalled();
		expect(mocks.createClient).toHaveBeenCalledWith(
			expect.objectContaining({
				url: "http://ai.example",
				fetch: expect.any(Function),
			}),
		);
		client.updateConfig({ provider: "auto", baseUrl: "", timeoutMs: 45000 });
		await client.extractTextEmbedding("海辺");
		expect(mocks.encode).toHaveBeenCalledWith("text", "海辺", {
			provider: "auto",
		});
	});
});

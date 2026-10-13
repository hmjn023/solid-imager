import { afterEach, describe, expect, it, vi } from "vitest";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";

const native = vi.hoisted(() => ({
	getPixaiTags: vi.fn(),
	ccipGetEmbedding: vi.fn(),
}));
vi.mock("~/infrastructure/ai/dghs-imgutils-loader", () => ({
	loadDghsImgutils: () => native,
}));
const tags = {
	general: {},
	character: {},
	attributes: {},
	ips: [],
	ipsMapping: {},
};

describe("AI inference memory boundary (no native models)", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});
	it("prevents competing cold model loads across client instances", async () => {
		let release = () => {};
		const coldLoad = new Promise<void>((resolve) => {
			release = resolve;
		});
		let loaded = false;
		let loads = 0;
		native.getPixaiTags.mockImplementation(async () => {
			if (!loaded) {
				loads++;
				await coldLoad;
				loaded = true;
			}
			return tags;
		});
		const first = new RustAiClient({ provider: "intel_gpu" });
		const second = new RustAiClient({ provider: "intel_gpu" });
		const pending = [first, second, first].map((client) =>
			client.tagImageByPath("/fake.png"),
		);
		try {
			await vi.waitFor(() => expect(native.getPixaiTags).toHaveBeenCalled());
			expect(loads).toBe(1);
		} finally {
			release();
			await Promise.all(pending);
		}
		expect(loads).toBe(1);
		expect(native.getPixaiTags).toHaveBeenCalledTimes(3);
	});
	it("uses the configured 120 second timeout for remote requests", async () => {
		vi.useFakeTimers();
		let aborted = false;
		vi.stubGlobal(
			"fetch",
			(_request: Request, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					const signal = init?.signal;
					if (!signal) throw new Error("Missing timeout signal");
					signal.addEventListener(
						"abort",
						() => {
							aborted = true;
							reject(signal.reason);
						},
						{ once: true },
					);
				}),
		);
		const client = new RustAiClient({
			baseUrl: "https://isolated-ai.invalid",
			timeoutMs: 120_000,
		});
		const pending = client.tagImage(
			new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
		);
		const settled = pending.catch((error: unknown) => error);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(90_000);
		expect(aborted).toBe(true);
		expect(await settled).toMatchObject({
			message: "API request timed out after 120000ms",
		});
	});
});

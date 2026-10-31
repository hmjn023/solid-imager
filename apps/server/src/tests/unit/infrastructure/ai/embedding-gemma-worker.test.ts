import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createNativeInferenceOptions } from "~/infrastructure/ai/inference-options";
import { EmbeddingGemmaWorker } from "~/infrastructure/ai/embedding-gemma-worker";

const mocks = vi.hoisted(() => ({
	modulePath: "",
	workers: [] as Worker[],
	info: vi.fn(),
	error: vi.fn(),
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: mocks.info, error: mocks.error },
}));
vi.mock("~/infrastructure/ai/dghs-imgutils-loader", () => ({
	resolveDghsImgutilsPath: () => mocks.modulePath,
}));
vi.mock("node:worker_threads", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:worker_threads")>();
	return {
		...actual,
		Worker: class extends actual.Worker {
			constructor(
				filename: string | URL,
				options?: import("node:worker_threads").WorkerOptions,
			) {
				super(filename, options);
				mocks.workers.push(this);
			}
		},
	};
});

describe("EmbeddingGemma worker inference settings", () => {
	let directory: string;
	afterEach(async () => {
		await Promise.all(
			mocks.workers.splice(0).map((worker) => worker.terminate()),
		);
		if (directory) await rm(directory, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it("passes provider/device to both native encoders and isolates queued configuration changes", async () => {
		directory = await mkdtemp(path.join(tmpdir(), "embedding-worker-test-"));
		mocks.modulePath = path.join(directory, "native.cjs");
		// Run the actual worker transport against a deterministic native boundary.
		await writeFile(
			mocks.modulePath,
			`
      function encode(kind, model, options) {
        if (options.backend || options.precision) throw new Error('Unexpected per-model override');
        if (model.dtype !== 'q8' || model.dimensions !== 768) throw new Error('Wrong model');
        const vector = Array(768).fill(0);
        vector[0] = kind;
        vector[1] = options.provider === 'cuda' ? 1 : options.provider === 'intel_gpu' ? 2 : 3;
        vector[2] = options.device === 'GPU.1' ? 1 : 0;
        return [vector];
      }
      exports.embeddinggemma2ImageEncode = (paths, model, options) => encode(1, model, options);
      exports.embeddinggemma2TextEncode = (texts, task, model, options) => {
        if (task !== 'SearchQuery') throw new Error('Wrong task');
        if (texts[0] === 'invalid-GPU-output') throw new Error('model returned a zero embedding');
        return encode(2, model, options);
      };
    `,
		);
		const worker = new EmbeddingGemmaWorker();
		const cuda = createNativeInferenceOptions({
			provider: "cuda",
			device: "1",
		});
		const first = worker.encode("image", "/image.png", cuda);
		Object.assign(cuda, createNativeInferenceOptions({ provider: "cpu" }));
		const second = worker.encode(
			"text",
			"海辺",
			createNativeInferenceOptions({
				provider: "intel_gpu",
				device: " GPU.1 ",
			}),
		);
		expect((await first).slice(0, 3)).toEqual([1, 1, 0]);
		expect((await second).slice(0, 3)).toEqual([2, 2, 1]);
		expect(mocks.workers).toHaveLength(1);
		await expect(
			worker.encode(
				"text",
				"invalid-GPU-output",
				createNativeInferenceOptions({ provider: "intel_gpu" }),
			),
		).rejects.toThrow("model returned a zero embedding");
		const third = await worker.encode(
			"text",
			"海辺",
			createNativeInferenceOptions({ provider: "cpu" }),
		);
		expect(third.slice(0, 3)).toEqual([2, 3, 0]);
		expect(mocks.info).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "image", provider: "cuda", device: "1" }),
			"EmbeddingGemma 2 first inference started (including model initialization)",
		);
		expect(mocks.info).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "image",
				provider: "cuda",
				durationMs: expect.any(Number),
			}),
			"EmbeddingGemma 2 first inference completed",
		);
		expect(mocks.error).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "text",
				provider: "intel_gpu",
				err: expect.any(Error),
			}),
			"EmbeddingGemma 2 first inference failed",
		);
		const logged = mocks.info.mock.calls.length;
		await worker.encode(
			"text",
			"海辺",
			createNativeInferenceOptions({ provider: "cpu" }),
		);
		expect(mocks.info).toHaveBeenCalledTimes(logged);
		expect(JSON.stringify(mocks.info.mock.calls)).not.toContain("海辺");
		expect(JSON.stringify(mocks.info.mock.calls)).not.toContain("/image.png");
	});
});

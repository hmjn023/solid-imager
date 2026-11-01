import { Worker } from "node:worker_threads";
import {
	EMBEDDING_GEMMA_MODEL,
	embeddingVectorSchema,
} from "@solid-imager/core/domain/search/embedding";
import { z } from "zod";
import type { NapiInferenceOptions } from "dghs-imgutils-rs";
import { resolveDghsImgutilsPath } from "./dghs-imgutils-loader";
import { logger } from "~/infrastructure/logger";

// A plain JS worker keeps the synchronous native calls off the request thread
// and remains deployable when Nitro bundles the server into ESM chunks.
const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
const native = require(workerData.modulePath);
parentPort.on('message', ({ kind, value, inferenceOptions }) => {
  try {
    const model = { dtype: 'q8', dimensions: 768 };
    const vectors = kind === 'image'
      ? native.embeddinggemma2ImageEncode([value], model, inferenceOptions)
      : native.embeddinggemma2TextEncode([value], 'SearchQuery', model, inferenceOptions);
    parentPort.postMessage({ feature: vectors[0] });
  } catch (error) {
    parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
});
`;

const responseSchema = z.union([
	z.object({ feature: embeddingVectorSchema }),
	z.object({ error: z.string() }),
]);

export class EmbeddingGemmaWorker {
	private worker: Worker | undefined;
	private queue: Promise<void> = Promise.resolve();
	private readonly initializedRequests = new Set<string>();

	encode(
		kind: "image" | "text",
		value: string,
		inferenceOptions: NapiInferenceOptions,
	): Promise<number[]> {
		const options = { ...inferenceOptions };
		const result = this.queue.then(() => this.run(kind, value, options));
		this.queue = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	private run(
		kind: "image" | "text",
		value: string,
		inferenceOptions: NapiInferenceOptions,
	): Promise<number[]> {
		if (!this.worker) {
			const created = new Worker(workerSource, {
				eval: true,
				workerData: { modulePath: resolveDghsImgutilsPath() },
			});
			this.worker = created;
			this.initializedRequests.clear();
			// Idle errors must also be observed, even after a request has completed.
			created.on("error", () => {
				if (this.worker === created) this.worker = undefined;
			});
			created.on("exit", () => {
				if (this.worker === created) this.worker = undefined;
			});
		}
		const worker = this.worker;
		const initializationKey = JSON.stringify({ kind, ...inferenceOptions });
		const initializing = !this.initializedRequests.has(initializationKey);
		const startedAt = performance.now();
		const context = {
			kind,
			model: EMBEDDING_GEMMA_MODEL,
			provider: inferenceOptions.provider ?? inferenceOptions.backend ?? "auto",
			device:
				inferenceOptions.device ??
				inferenceOptions.openvinoDeviceType ??
				inferenceOptions.deviceId ??
				"default",
		};
		if (initializing)
			logger.info(
				context,
				"EmbeddingGemma 2 first inference started (including model initialization)",
			);
		worker.ref();
		return new Promise((resolve, reject) => {
			const cleanup = () => {
				clearTimeout(timer);
				worker.off("message", onMessage);
				worker.off("error", onError);
				worker.off("exit", onExit);
				worker.unref();
			};
			const onError = (error: Error) => {
				cleanup();
				if (initializing)
					logger.error(
						{
							...context,
							err: error,
							durationMs: Math.round(performance.now() - startedAt),
						},
						"EmbeddingGemma 2 first inference failed",
					);
				reject(error);
			};
			const onExit = (code: number) =>
				onError(new Error(`EmbeddingGemma 2 worker exited (${code})`));
			const onMessage = (value: unknown) => {
				const parsed = responseSchema.safeParse(value);
				if (!parsed.success) {
					onError(new Error("Invalid EmbeddingGemma 2 response"));
					return;
				}
				if ("error" in parsed.data) {
					onError(new Error(parsed.data.error));
					return;
				}
				cleanup();
				if (initializing) {
					this.initializedRequests.add(initializationKey);
					logger.info(
						{
							...context,
							durationMs: Math.round(performance.now() - startedAt),
						},
						"EmbeddingGemma 2 first inference completed",
					);
				}
				resolve(parsed.data.feature);
			};
			const timer = setTimeout(
				() => {
					this.worker = undefined;
					onError(new Error("EmbeddingGemma 2 inference timed out"));
					void worker.terminate();
				},
				10 * 60 * 1000,
			);
			worker.once("message", onMessage);
			worker.once("error", onError);
			worker.once("exit", onExit);
			worker.postMessage({ kind, value, inferenceOptions });
		});
	}
}

export const embeddingGemmaWorker = new EmbeddingGemmaWorker();

import type { InferenceLifecycle } from "./inference-lifecycle";
import type { NativeInferenceProcess } from "./native-inference-process";
import {
	EMBEDDING_GEMMA_DIMENSIONS,
	EMBEDDING_GEMMA_MODEL,
	embeddingVectorSchema,
} from "@solid-imager/core/search";
import type { NapiInferenceOptions } from "dghs-imgutils-rs";
import { logger } from "./logger";

export class EmbeddingGemmaWorker {
	private queue: Promise<void> = Promise.resolve();
	private readonly initializedRequests = new Set<string>();
	private generation = -1;

	constructor(
		private readonly lifecycle: InferenceLifecycle,
		private readonly native: NativeInferenceProcess,
	) {}

	encode(
		kind: "image" | "text",
		value: string,
		inferenceOptions: NapiInferenceOptions,
	): Promise<number[]> {
		const options = { ...inferenceOptions };
		return this.lifecycle.run("embedding", () => {
			const pending = this.queue.then(() => this.run(kind, value, options));
			this.queue = pending.then(
				() => undefined,
				() => undefined,
			);
			return pending;
		});
	}

	private async run(
		kind: "image" | "text",
		value: string,
		options: NapiInferenceOptions,
	) {
		if (this.generation !== this.lifecycle.generation) {
			this.generation = this.lifecycle.generation;
			this.initializedRequests.clear();
		}
		const key = JSON.stringify({ kind, ...options });
		const initializing = !this.initializedRequests.has(key);
		const startedAt = performance.now();
		const context = {
			kind,
			model: EMBEDDING_GEMMA_MODEL,
			provider: options.provider ?? options.backend ?? "auto",
			device:
				options.device ??
				options.openvinoDeviceType ??
				options.deviceId ??
				"default",
		};
		if (initializing)
			logger.info(
				context,
				"EmbeddingGemma 2 first inference started (including model initialization)",
			);
		try {
			const model = { dtype: "q8", dimensions: EMBEDDING_GEMMA_DIMENSIONS };
			const vectors =
				kind === "image"
					? await this.native.call(
							"embeddinggemma2ImageEncode",
							[value],
							model,
							options,
						)
					: await this.native.call(
							"embeddinggemma2TextEncode",
							[value],
							"SearchQuery",
							model,
							options,
						);
			const feature = embeddingVectorSchema.parse(vectors[0]);
			if (initializing) {
				this.initializedRequests.add(key);
				logger.info(
					{ ...context, durationMs: Math.round(performance.now() - startedAt) },
					"EmbeddingGemma 2 first inference completed",
				);
			}
			return feature;
		} catch (err) {
			if (initializing)
				logger.error(
					{
						...context,
						err,
						durationMs: Math.round(performance.now() - startedAt),
					},
					"EmbeddingGemma 2 first inference failed",
				);
			throw err;
		}
	}
}

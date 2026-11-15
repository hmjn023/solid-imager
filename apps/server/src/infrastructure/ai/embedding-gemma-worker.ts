import { inferenceLifecycle } from "./inference-lifecycle";
import { nativeInferenceProcess } from "./native-inference-process";
import {
	EMBEDDING_GEMMA_MODEL,
	embeddingVectorSchema,
} from "@solid-imager/core/search";
import type { NapiInferenceOptions } from "dghs-imgutils-rs";
import { logger } from "~/infrastructure/logger";

export class EmbeddingGemmaWorker {
	private queue: Promise<void> = Promise.resolve();
	private readonly initializedRequests = new Set<string>();
	private generation = -1;

	encode(
		kind: "image" | "text",
		value: string,
		inferenceOptions: NapiInferenceOptions,
	): Promise<number[]> {
		const options = { ...inferenceOptions };
		return inferenceLifecycle.run("embedding", () => {
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
		if (this.generation !== inferenceLifecycle.generation) {
			this.generation = inferenceLifecycle.generation;
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
			const model = { dtype: "q8", dimensions: 768 };
			const vectors =
				kind === "image"
					? await nativeInferenceProcess.call(
							"embeddinggemma2ImageEncode",
							[value],
							model,
							options,
						)
					: await nativeInferenceProcess.call(
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
export const embeddingGemmaWorker = new EmbeddingGemmaWorker();

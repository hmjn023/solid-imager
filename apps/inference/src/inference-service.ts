import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ORPCError } from "@orpc/server";
import {
	EMBEDDING_GEMMA_DIMENSIONS,
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
} from "@solid-imager/core/search";
import {
	CCIP_DIMENSIONS,
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
	type CharacterCrop,
} from "@solid-imager/core/tagging";
import sharp from "sharp";
import { EmbeddingGemmaWorker } from "./embedding-gemma-worker";
import { InferenceLifecycle } from "./inference-lifecycle";
import { createNativeInferenceOptions } from "./inference-options";
import { logger } from "./logger";
import { NativeInferenceProcess } from "./native-inference-process";

const MAX_PENDING_REQUESTS = 16;
const IDLE_OFFLOAD_MS = 60_000;

function extensionFor(bytes: Uint8Array, name: string): string {
	if (bytes[0] === 0x89 && bytes[1] === 0x50) return ".png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return ".jpg";
	const magic = String.fromCharCode(...bytes.subarray(0, 4));
	if (magic === "RIFF") return ".webp";
	if (magic.startsWith("GIF")) return ".gif";
	const extension = path.extname(name);
	return /^\.[a-z0-9]{1,8}$/i.test(extension) ? extension : ".png";
}

async function withImage<T>(
	file: File,
	processImage: (imagePath: string, directory: string) => Promise<T>,
): Promise<T> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const directory = await mkdtemp(
		path.join(tmpdir(), "solid-imager-inference-"),
	);
	try {
		const imagePath = path.join(
			directory,
			`image${extensionFor(bytes, file.name)}`,
		);
		await writeFile(imagePath, bytes);
		return await processImage(imagePath, directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function embeddingOutput(feature: number[]) {
	return {
		feature,
		model: EMBEDDING_GEMMA_MODEL,
		version: EMBEDDING_GEMMA_VERSION,
		dimensions: EMBEDDING_GEMMA_DIMENSIONS,
	} as const;
}

export function createInferenceService(
	config: Parameters<typeof createNativeInferenceOptions>[0],
	idleOffloadMs = IDLE_OFFLOAD_MS,
) {
	const options = createNativeInferenceOptions(config);
	const native = new NativeInferenceProcess(options);
	const lifecycle = new InferenceLifecycle(() => native.offload());
	const embeddingWorker = new EmbeddingGemmaWorker(lifecycle, native);
	let pending = 0;
	let tail = Promise.resolve();
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	let readiness: Promise<boolean> | undefined;

	function run<T>(
		signal: AbortSignal | undefined,
		execute: () => Promise<T>,
	): Promise<T> {
		if (pending >= MAX_PENDING_REQUESTS) {
			throw new ORPCError("TOO_MANY_REQUESTS", {
				message: "Inference queue is full",
			});
		}
		clearTimeout(idleTimer);
		pending++;
		const result = tail.then(() => {
			signal?.throwIfAborted();
			return execute();
		});
		const finish = () => {
			pending--;
			if (pending !== 0) return;
			idleTimer = setTimeout(() => {
				tail = lifecycle.offload().catch((err) => {
					logger.error({ err }, "Idle model offload failed");
				});
			}, idleOffloadMs);
			idleTimer.unref();
		};
		tail = result.then(finish, finish);
		return result;
	}

	function isAvailable(): Promise<boolean> {
		const backend = config.provider.startsWith("intel_")
			? "openvino"
			: config.provider.replaceAll("_", "-");
		readiness ??= native
			.call("probeInferenceBackends", options)
			.then((providers) =>
				providers.some(
					(provider) =>
						provider.available &&
						(backend === "auto" || provider.backend === backend),
				),
			)
			.catch((err) => {
				logger.warn(
					{ err, provider: config.provider },
					"Inference runtime probe failed",
				);
				return false;
			})
			.then((available) => {
				if (!available) readiness = undefined;
				return available;
			});
		return readiness;
	}

	return {
		run,
		isAvailable,
		offload: () => lifecycle.offload(),
		async stop() {
			await tail;
			clearTimeout(idleTimer);
			await native.stop();
		},
		tag: (file: File) =>
			withImage(file, async (imagePath) => {
				const result = await lifecycle.run("tagging", () =>
					native.call("getPixaiTags", imagePath, undefined, undefined, options),
				);
				return {
					general: result.general,
					character: result.character,
					attributes: "attributes" in result ? result.attributes : {},
					ips: result.ips,
					ips_mapping: result.ipsMapping,
				};
			}),
		tagOppaiOracle: (file: File) =>
			withImage(file, async (imagePath) =>
				lifecycle.run("oppaioracle", () =>
					native.call(
						"getOppaioracleTags",
						imagePath,
						undefined,
						undefined,
						undefined,
						options,
					),
				),
			),
		ccipFeature: (file: File) =>
			withImage(
				file,
				async (imagePath) =>
					({
						feature: await lifecycle.run("ccip", () =>
							native.call("ccipGetEmbedding", imagePath, CCIP_MODEL, options),
						),
						model: CCIP_MODEL,
						version: CCIP_EMBEDDING_VERSION,
						dimensions: CCIP_DIMENSIONS,
					}) as const,
			),
		ccipDifference: async (feature1: number[], feature2: number[]) => ({
			difference: await lifecycle.run("ccip-distance", () =>
				native.call("ccipDistance", feature1, feature2, CCIP_MODEL),
			),
		}),
		ccipDistances: async (feature: number[], candidates: number[][]) => ({
			distances: await lifecycle.run("ccip-distance", () =>
				native.call("ccipDistances", feature, candidates, CCIP_MODEL),
			),
		}),
		embeddingImage: (file: File) =>
			withImage(file, async (imagePath, directory) => {
				const pngPath = path.join(directory, "embedding.png");
				await sharp(imagePath).png().toFile(pngPath);
				return embeddingOutput(
					await embeddingWorker.encode("image", pngPath, options),
				);
			}),
		embeddingText: async (text: string) =>
			embeddingOutput(await embeddingWorker.encode("text", text, options)),
		detectAndCropCharacters: (file: File, transparent: boolean) =>
			withImage(file, async (imagePath, directory) => {
				const detections = await lifecycle.run("detection", () =>
					native.call(
						"detectPerson",
						imagePath,
						undefined,
						undefined,
						undefined,
						undefined,
						options,
					),
				);
				const crops: CharacterCrop[] = [];
				for (const [index, { bbox, label, score }] of detections.entries()) {
					const width = Math.round(bbox.x2 - bbox.x1);
					const height = Math.round(bbox.y2 - bbox.y1);
					const crop = sharp(imagePath).extract({
						left: Math.round(bbox.x1),
						top: Math.round(bbox.y1),
						width,
						height,
					});
					let imageBase64: string;
					if (transparent) {
						const cropPath = path.join(directory, `${index}.png`);
						await crop.png().toFile(cropPath);
						imageBase64 = await lifecycle.run("segmentation", () =>
							native.call("segmentPngBase64", cropPath, undefined, options),
						);
					} else {
						imageBase64 = (await crop.webp().toBuffer()).toString("base64");
					}
					crops.push({
						index,
						bbox,
						label,
						score,
						imageBase64,
						width,
						height,
						format: transparent ? "png" : "webp",
					});
				}
				return { detections: crops };
			}),
	};
}

export type InferenceService = ReturnType<typeof createInferenceService>;

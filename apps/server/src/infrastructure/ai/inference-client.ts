import path from "node:path";
import { ORPCError } from "@orpc/server";
import { APIError, createClient } from "@solid-imager/client";
import type { AiConfig } from "@solid-imager/core/config";
import { inferenceContract } from "@solid-imager/core/contract";
import type { IAiClient } from "@solid-imager/core/ports";

type ClientConfig = Pick<AiConfig, "baseUrl" | "timeoutMs">;
type Credentials = { baseUrl: string; token: string };
type Client = ReturnType<typeof createClient<typeof inferenceContract>>;

function toFile(image: File | ArrayBuffer): File {
	return image instanceof File ? image : new File([image], "image");
}

async function fileFromPath(filePath: string): Promise<File> {
	const file = Bun.file(filePath);
	return new File([await file.arrayBuffer()], path.basename(filePath), {
		type: file.type,
	});
}

export class InferenceClient implements IAiClient {
	private client?: Client;
	private healthClient?: Client;

	constructor(
		config: ClientConfig = { baseUrl: "", timeoutMs: 30_000 },
		private readonly credentials?: Credentials,
	) {
		this.updateConfig(config);
	}

	updateConfig(config: ClientConfig): void {
		const baseUrl = config.baseUrl.trim();
		this.client = undefined;
		this.healthClient = undefined;
		if (!baseUrl) return;
		const url = URL.parse(baseUrl);
		if (!url || !["http:", "https:"].includes(url.protocol)) return;

		const token =
			this.credentials && URL.parse(this.credentials.baseUrl)?.href === url.href
				? this.credentials.token
				: undefined;
		const transport = {
			url: baseUrl,
			fetch: (request: string, init?: RequestInit) => {
				const headers = new Headers(init?.headers);
				if (token) headers.set("authorization", `Bearer ${token}`);
				return fetch(request, { ...init, headers, redirect: "error" });
			},
		};
		this.client = createClient(inferenceContract, {
			...transport,
			timeoutMs: config.timeoutMs,
		});
		this.healthClient = createClient(inferenceContract, {
			...transport,
			timeoutMs: Math.min(config.timeoutMs, 3_000),
		});
	}

	private async call<T>(invoke: (client: Client) => Promise<T>): Promise<T> {
		if (!this.client) {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: "Inference service URL is not configured",
			});
		}
		try {
			return await invoke(this.client);
		} catch (cause) {
			if (cause instanceof APIError && cause.code === "TIMEOUT") {
				throw new ORPCError("GATEWAY_TIMEOUT", {
					message: "Inference request timed out",
					cause,
				});
			}
			if (cause instanceof APIError && cause.code === "NETWORK_ERROR") {
				throw new ORPCError("SERVICE_UNAVAILABLE", {
					message: "Inference service is unavailable",
					cause,
				});
			}
			throw cause;
		}
	}

	async healthCheck(): Promise<boolean> {
		try {
			return (await this.healthClient?.health())?.available ?? false;
		} catch {
			return false;
		}
	}

	async offload(): Promise<void> {
		await this.call((client) => client.offload({}));
	}

	async tagImage(image: ArrayBuffer) {
		return this.call((client) => client.tag({ file: toFile(image) }));
	}

	async tagImageByPath(filePath: string) {
		return this.call(async (client) =>
			client.tag({ file: await fileFromPath(filePath) }),
		);
	}

	async tagImageOppaiOracle(file: File) {
		return this.call((client) => client.tagOppaiOracle({ file }));
	}

	async tagImageOppaiOracleByPath(filePath: string) {
		return this.call(async (client) =>
			client.tagOppaiOracle({ file: await fileFromPath(filePath) }),
		);
	}

	async extractImageEmbedding(image: ArrayBuffer | File) {
		return this.call(
			async (client) =>
				(await client.embeddingImage({ file: toFile(image) })).feature,
		);
	}

	async extractImageEmbeddingByPath(filePath: string) {
		return this.call(
			async (client) =>
				(await client.embeddingImage({ file: await fileFromPath(filePath) }))
					.feature,
		);
	}

	async extractTextEmbedding(text: string) {
		return this.call(
			async (client) => (await client.embeddingText({ text })).feature,
		);
	}

	async extractCcipFeature(image: ArrayBuffer) {
		const { feature } = await this.call((client) =>
			client.ccipFeature({ file: toFile(image) }),
		);
		return { feature };
	}

	async extractCcipFeatureByPath(filePath: string) {
		const { feature } = await this.call(async (client) =>
			client.ccipFeature({ file: await fileFromPath(filePath) }),
		);
		return { feature };
	}

	async calculateCcipDifference(feature1: number[], feature2: number[]) {
		return this.call((client) => client.ccipDifference({ feature1, feature2 }));
	}

	async calculateCcipDistances(feature: number[], candidates: number[][]) {
		const { distances } = await this.call((client) =>
			client.ccipDistances({ feature, candidates }),
		);
		return distances;
	}

	async detectAndCropCharacters(file: File, transparent: boolean) {
		return this.call((client) =>
			client.detectAndCropCharacters({ file, transparent }),
		);
	}

	async detectAndCropCharactersByPath(filePath: string, transparent: boolean) {
		return this.call(async (client) =>
			client.detectAndCropCharacters({
				file: await fileFromPath(filePath),
				transparent,
			}),
		);
	}
}

import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import {
	type CcipDifferenceResponse,
	type CcipFeatureResponse,
	ccipDifferenceResponseSchema,
	ccipFeatureResponseSchema,
	type TaggingResponse,
	taggingResponseSchema,
} from "@solid-imager/core/domain/tagging/schemas";

export class RustAiClient implements IAiClient {
	private baseUrl: string;
	private timeoutMs: number;

	constructor(baseUrl = "", timeoutMs = 30_000) {
		this.baseUrl = baseUrl;
		this.timeoutMs = timeoutMs;
	}

	updateConfig(config: { baseUrl: string; timeoutMs: number }) {
		this.baseUrl = config.baseUrl;
		this.timeoutMs = config.timeoutMs;
	}

	getBaseUrl(): string {
		return this.baseUrl;
	}

	async healthCheck(): Promise<boolean> {
		try {
			const { getVersion } = await import("dghs-imgutils-rs");
			return typeof getVersion() === "string";
		} catch {
			return false;
		}
	}

	private async withTempFile<T>(
		buffer: ArrayBuffer,
		prefix: string,
		callback: (filePath: string) => Promise<T>,
	): Promise<T> {
		const tmpPath = path.join(
			tmpdir(),
			`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
		);
		await fs.promises.writeFile(tmpPath, Buffer.from(buffer));
		try {
			return await callback(tmpPath);
		} finally {
			await fs.promises.unlink(tmpPath).catch(() => {});
		}
	}

	async tagImage(imageBuffer: ArrayBuffer): Promise<TaggingResponse> {
		return this.withTempFile(imageBuffer, "rust-tag", (filePath) =>
			this.tagImageByPath(filePath),
		);
	}

	async tagImageByPath(filePath: string): Promise<TaggingResponse> {
		const { getPixaiTags } = await import("dghs-imgutils-rs");
		const result = await getPixaiTags(filePath);
		return taggingResponseSchema.parse({
			general: result.general,
			character: result.character,
			ips: result.ips,
			ips_mapping: result.ipsMapping,
		});
	}

	async extractCcipFeature(
		imageBuffer: ArrayBuffer,
	): Promise<CcipFeatureResponse> {
		return this.withTempFile(imageBuffer, "rust-ccip", (filePath) =>
			this.extractCcipFeatureByPath(filePath),
		);
	}

	async extractCcipFeatureByPath(
		filePath: string,
	): Promise<CcipFeatureResponse> {
		const { ccipGetEmbedding } = await import("dghs-imgutils-rs");
		const embedding = await ccipGetEmbedding(filePath);
		return ccipFeatureResponseSchema.parse({
			feature: embedding,
		});
	}

	async calculateCcipDifference(
		feature1: number[],
		feature2: number[],
	): Promise<CcipDifferenceResponse> {
		const { ccipDistance } = await import("dghs-imgutils-rs");
		const distance = await ccipDistance(feature1, feature2);
		return ccipDifferenceResponseSchema.parse({
			difference: distance,
		});
	}
}

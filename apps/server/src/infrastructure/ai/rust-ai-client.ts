import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@solid-imager/client";
import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import {
	type CcipDifferenceResponse,
	type CcipFeatureResponse,
	ccipDifferenceResponseSchema,
	ccipFeatureResponseSchema,
	type TaggingResponse,
	taggingResponseSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import type { appRouter } from "~/domain/shared/api-contract";

function createRemoteOrpcClient(remoteUrl: string, timeoutMs: number) {
	return createClient<typeof appRouter>({
		url: remoteUrl,
		fetch: (request: Request, init?: RequestInit) =>
			fetch(request, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
	});
}

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
		if (this.baseUrl) {
			try {
				const client = createRemoteOrpcClient(this.baseUrl, this.timeoutMs);
				await client.config.get();
				return true;
			} catch {
				return false;
			}
		}

		try {
			const { getVersion } = await import("dghs-imgutils-rs");
			return typeof getVersion() === "string";
		} catch {
			return false;
		}
	}

	private getExtensionFromBuffer(buffer: ArrayBuffer | Uint8Array): string {
		const bytes =
			buffer instanceof Uint8Array
				? buffer.subarray(0, 4)
				: new Uint8Array(buffer, 0, 4);
		if (
			bytes[0] === 0x89 &&
			bytes[1] === 0x50 &&
			bytes[2] === 0x4e &&
			bytes[3] === 0x47
		)
			return ".png";
		if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
			return ".jpg";
		if (
			bytes[0] === 0x52 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x46
		)
			return ".webp";
		if (
			bytes[0] === 0x47 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x38
		)
			return ".gif";
		return ".png"; // fallback
	}

	private async callRemoteOrpcWithFile<T>(
		action: (
			client: ReturnType<typeof createRemoteOrpcClient>,
			file: File,
		) => Promise<T>,
		buffer: ArrayBuffer | Uint8Array,
		fileName?: string,
	): Promise<T> {
		const client = createRemoteOrpcClient(this.baseUrl, this.timeoutMs);
		const finalName = fileName || `image${this.getExtensionFromBuffer(buffer)}`;
		const fileData =
			buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
		const file = new File([fileData as BlobPart], finalName);
		return action(client, file);
	}

	private async withTempFile<T>(
		buffer: ArrayBuffer | Uint8Array,
		prefix: string,
		callback: (filePath: string) => Promise<T>,
	): Promise<T> {
		const ext = this.getExtensionFromBuffer(buffer);
		const tmpPath = path.join(
			tmpdir(),
			`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`,
		);
		const fileData =
			buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
		await fs.promises.writeFile(tmpPath, fileData);
		try {
			return await callback(tmpPath);
		} finally {
			await fs.promises.unlink(tmpPath).catch(() => {});
		}
	}

	async tagImage(imageBuffer: ArrayBuffer): Promise<TaggingResponse> {
		if (this.baseUrl) {
			const result = await this.callRemoteOrpcWithFile(
				(c, f) => c.ai.tag({ file: f }),
				imageBuffer,
			);
			return taggingResponseSchema.parse(result);
		}

		return this.withTempFile(imageBuffer, "rust-tag", (filePath) =>
			this.tagImageByPath(filePath),
		);
	}

	async tagImageByPath(filePath: string): Promise<TaggingResponse> {
		if (this.baseUrl) {
			const buffer = await fs.promises.readFile(filePath);
			const result = await this.callRemoteOrpcWithFile(
				(c, f) => c.ai.tag({ file: f }),
				buffer,
				path.basename(filePath),
			);
			return taggingResponseSchema.parse(result);
		}

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
		if (this.baseUrl) {
			const result = await this.callRemoteOrpcWithFile(
				(c, f) => c.ai.ccipFeature({ file: f }),
				imageBuffer,
			);
			return ccipFeatureResponseSchema.parse(result);
		}

		return this.withTempFile(imageBuffer, "rust-ccip", (filePath) =>
			this.extractCcipFeatureByPath(filePath),
		);
	}

	async extractCcipFeatureByPath(
		filePath: string,
	): Promise<CcipFeatureResponse> {
		if (this.baseUrl) {
			const buffer = await fs.promises.readFile(filePath);
			const result = await this.callRemoteOrpcWithFile(
				(c, f) => c.ai.ccipFeature({ file: f }),
				buffer,
				path.basename(filePath),
			);
			return ccipFeatureResponseSchema.parse(result);
		}

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
		if (this.baseUrl) {
			const client = createRemoteOrpcClient(this.baseUrl, this.timeoutMs);
			const result = await client.ai.ccipDifference({ feature1, feature2 });
			return ccipDifferenceResponseSchema.parse(result);
		}

		const { ccipDistance } = await import("dghs-imgutils-rs");
		const distance = await ccipDistance(feature1, feature2);
		return ccipDifferenceResponseSchema.parse({
			difference: distance,
		});
	}
}

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	EMBEDDING_GEMMA_DIMENSIONS,
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
} from "@solid-imager/core/search";
import { afterEach, expect, it, vi } from "vitest";
import { InferenceClient } from "~/infrastructure/ai/inference-client";

afterEach(() => vi.unstubAllGlobals());

it("uploads local files as multipart data and targets the dedicated service", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "inference-client-"));
	try {
		const thumbnailPath = path.join(directory, "frame.webp");
		await writeFile(thumbnailPath, new Uint8Array([1, 2, 3]));
		const feature = Array<number>(EMBEDDING_GEMMA_DIMENSIONS).fill(1);
		const fetch = vi.fn(async (url: string, init?: RequestInit) => {
			const request = new Request(url, init);
			expect(request.url).toBe(
				"http://127.0.0.1:3001/api/inference/embeddings/image",
			);
			expect(request.headers.get("authorization")).toBe("Bearer test-token");
			const file = (await request.formData()).get("file");
			expect(file).toBeInstanceOf(File);
			if (!(file instanceof File)) throw new Error("Missing file");
			expect(file.name).toBe("frame.webp");
			expect(new Uint8Array(await file.arrayBuffer())).toEqual(
				new Uint8Array([1, 2, 3]),
			);
			return Response.json({
				feature,
				model: EMBEDDING_GEMMA_MODEL,
				version: EMBEDDING_GEMMA_VERSION,
				dimensions: EMBEDDING_GEMMA_DIMENSIONS,
			});
		});
		vi.stubGlobal("fetch", fetch);
		const client = new InferenceClient(
			{ baseUrl: "http://127.0.0.1:3001", timeoutMs: 1000 },
			{ baseUrl: "http://127.0.0.1:3001", token: "test-token" },
		);
		await expect(
			client.extractImageEmbeddingByPath(thumbnailPath),
		).resolves.toEqual(feature);
		expect(fetch).toHaveBeenCalledOnce();
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

it("checks inference readiness and rejects a vector from an incompatible space", async () => {
	const fetch = vi.fn(async (url: string) => {
		if (url.endsWith("/api/inference/health"))
			return Response.json({ available: true });
		return Response.json({
			feature: Array<number>(EMBEDDING_GEMMA_DIMENSIONS).fill(1),
			model: EMBEDDING_GEMMA_MODEL,
			version: EMBEDDING_GEMMA_VERSION + 1,
			dimensions: EMBEDDING_GEMMA_DIMENSIONS,
		});
	});
	vi.stubGlobal("fetch", fetch);
	const client = new InferenceClient({
		baseUrl: "https://inference.example.test",
		timeoutMs: 1000,
	});
	await expect(client.healthCheck()).resolves.toBe(true);
	await expect(client.extractTextEmbedding("query")).rejects.toThrow();
	client.updateConfig({ baseUrl: "", timeoutMs: 1000 });
	await expect(client.healthCheck()).resolves.toBe(false);
	await expect(client.extractTextEmbedding("query")).rejects.toMatchObject({
		code: "SERVICE_UNAVAILABLE",
	});
	expect(fetch).toHaveBeenCalledTimes(2);
});

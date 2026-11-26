import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, it, vi } from "vitest";
import { createInferenceHandler } from "../http-handler";
import { createInferenceService } from "../inference-service";

const fixture = vi.hoisted(() => ({ modulePath: "" }));
vi.mock("../dghs-imgutils-loader", () => ({
	resolveDghsImgutilsPath: () => fixture.modulePath,
}));

it("serves authorized inference requests through the multipart and JSON contracts", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "inference-http-"));
	const service = createInferenceService({ provider: "cpu" });
	const handler = createInferenceHandler(service, "test-token");
	function request(
		route: string,
		body?: FormData | Record<string, string | number[] | number[][]>,
	) {
		const headers = new Headers({ authorization: "Bearer test-token" });
		if (body && !(body instanceof FormData))
			headers.set("content-type", "application/json");
		return handler(
			new Request(`http://inference/api/inference${route}`, {
				method: body ? "POST" : "GET",
				headers,
				body: body instanceof FormData ? body : body && JSON.stringify(body),
			}),
		);
	}
	try {
		fixture.modulePath = path.join(directory, "native.cjs");
		await writeFile(
			fixture.modulePath,
			`
			const fs = require("node:fs");
			const vector = Array(768).fill(1);
			exports.configureInference = ({ provider }) => {
				if (provider !== "cpu") throw new Error("Unexpected provider");
			};
			exports.probeInferenceBackends = () => [{ backend: "cpu", available: true }];
			exports.offloadInferenceSessions = () => {};
			exports.getPixaiTags = (file) => {
				fs.accessSync(file);
				return { general: { outdoors: 1 }, character: {}, ips: [], ipsMapping: {} };
			};
			exports.getOppaioracleTags = () => ({ general: {}, rating: {}, tag: {} });
			exports.ccipGetEmbedding = () => vector;
			exports.ccipDistance = (_, candidate) => candidate[0];
			exports.embeddinggemma2ImageEncode = ([file]) => {
				fs.accessSync(file);
				return [vector];
			};
			exports.embeddinggemma2TextEncode = () => [vector];
			exports.detectPerson = () => [{ bbox: { x1: 0, y1: 0, x2: 2, y2: 2 }, label: "person", score: 1 }];
			exports.segmentRgbaWithIsnetis = (file) => [...fs.readFileSync(file)];
		`,
		);
		const health = new Request("http://inference/api/inference/health");
		expect((await handler(health)).status).toBe(401);
		const crossOrigin = new Request(health, {
			headers: {
				origin: "https://other.example",
				authorization: "Bearer test-token",
			},
		});
		expect((await handler(crossOrigin)).status).toBe(403);
		expect(await (await request("/health")).json()).toEqual({
			available: true,
		});

		const png = await sharp({
			create: { width: 2, height: 2, channels: 3, background: "navy" },
		})
			.png()
			.toBuffer();
		const image = new FormData();
		image.append("file", new File([new Uint8Array(png)], "sample.png"));
		expect(await (await request("/tag", image)).json()).toMatchObject({
			general: { outdoors: 1 },
		});
		expect((await request("/tag/oppai-oracle", image)).status).toBe(200);
		expect(await (await request("/ccip/features", image)).json()).toMatchObject(
			{ version: 1, dimensions: 768 },
		);
		expect(
			await (await request("/embeddings/image", image)).json(),
		).toMatchObject({ version: 1, dimensions: 768 });
		expect(
			await (await request("/embeddings/text", { text: "query" })).json(),
		).toMatchObject({ version: 1, dimensions: 768 });
		const feature = Array<number>(768).fill(1);
		const candidate = Array<number>(768).fill(2);
		expect(
			await (
				await request("/ccip/difference", {
					feature1: feature,
					feature2: candidate,
				})
			).json(),
		).toEqual({ difference: 2 });
		expect(
			await (
				await request("/ccip/distances", {
					feature,
					candidates: [candidate, feature],
				})
			).json(),
		).toEqual({ distances: [2, 1] });
		image.append("transparent", "true");
		expect(
			await (await request("/character-crops", image)).json(),
		).toMatchObject({
			detections: [
				{ format: "png", imageBase64: expect.stringMatching(/^iVBORw0KGgo/) },
			],
		});
		expect(await (await request("/offload", {})).json()).toEqual({});
	} finally {
		await service.stop();
		await rm(directory, { recursive: true, force: true });
	}
}, 15000);

import { createRouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { requestHandler } from "@tanstack/start-server-core";
import { AiInferenceBusyError } from "@solid-imager/core/domain/errors";
import {
	beforeAll,
	beforeEach,
	afterEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { services } from "~/infrastructure/service-registry";
import { aiRouter } from "~/infrastructure/api/routers/ai-router";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";
import { AiRequestAdmission } from "~/infrastructure/ai/ai-request-admission";
import { withRequestAbortHandling } from "~/infrastructure/http/request-abort-handler";

describe("AI HTTP observation cancellation", () => {
	beforeAll(async () => {
		await services.getJobWorker().stop();
		await services.getMediaAiWorker().stop();
		await services.getMediaFileWorker().stop();
	});
	beforeEach(() => {
		const settings = {
			model: "test",
			modelVersion: "v1",
			runtimeVersion: "v1",
			provider: "cpu",
			device: null,
			endpoint: "",
		};
		vi.spyOn(services.getAiClient(), "getTaggingSettings").mockReturnValue(
			settings,
		);
		vi.spyOn(services.getAiClient(), "getCcipSettings").mockReturnValue({
			...settings,
			embeddingVersion: 1,
			dimensions: 768,
		});
	});
	afterEach(() => vi.restoreAllMocks());
	it.each(["tag", "ccipFeature"] as const)(
		"releases the %s HTTP slot while keeping its request queued",
		async (procedure) => {
			const source = await services.getSourceRepository().create({
				name: "Abort fixture",
				description: null,
				type: "local",
				connectionInfo: { path: "/fixture" },
			});
			const media = await services.getMediaRepository().create({
				mediaSourceId: source.id,
				filePath: "image.png",
				fileName: "image.png",
				mediaType: "image",
				fileSize: 42,
				width: 16,
				height: 16,
				description: null,
				createdAt: new Date(),
				modifiedAt: new Date(),
			});
			const handler = new RPCHandler({ ai: aiRouter });
			const admission = new AiRequestAdmission(1);
			const endpoint = withRequestAbortHandling(
				requestHandler(async (request) => {
					const release = admission.acquire(request.url);
					if (release instanceof Response) return release;
					try {
						const result = await handler.handle(request, {
							prefix: "/api/rpc",
						});
						return result.response ?? new Response(null, { status: 404 });
					} finally {
						release();
					}
				}),
			);
			const controller = new AbortController();
			const request = new Request(
				`http://fixture.invalid/api/rpc/ai/${procedure}`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						json: { mediaSourceId: source.id, mediaId: media.id },
					}),
					signal: controller.signal,
				},
			);
			const response = endpoint(request);
			const kind = procedure === "tag" ? "tagging" : "ccip";
			const current = async () =>
				(await MediaProcessingStateRepository.findByMediaIds([media.id])).find(
					(state) => state.taskKind === kind,
				);
			await vi.waitFor(async () =>
				expect(await current()).toMatchObject({
					status: "pending",
					attemptCount: 0,
				}),
			);
			const before = await current();
			controller.abort(
				new DOMException("The connection was closed.", "AbortError"),
			);
			expect((await response).status).toBe(499);
			expect(await current()).toEqual(before);
			const next = admission.acquire(request.url);
			expect(typeof next).toBe("function");
			if (typeof next === "function") next();
		},
	);
	it.each(["tag", "ccipFeature"] as const)(
		"preserves HTTP 429 for native admission errors at the %s boundary",
		async (procedure) => {
			vi.spyOn(
				services.getAiClient(),
				procedure === "tag" ? "tagImage" : "extractCcipFeature",
			).mockRejectedValue(new AiInferenceBusyError());
			const client = createRouterClient(aiRouter);
			const input = { file: new File(["fixture"], "image.png") };
			await expect(
				procedure === "tag" ? client.tag(input) : client.ccipFeature(input),
			).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", status: 429 });
		},
	);
});

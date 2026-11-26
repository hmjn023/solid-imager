import { timingSafeEqual } from "node:crypto";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { implement, ORPCError } from "@orpc/server";
import { inferenceContract } from "@solid-imager/core/contract";
import { API_PREFIX } from "@solid-imager/core/http";
import type { InferenceService } from "./inference-service";
import { logger } from "./logger";

export function createInferenceHandler(
	service: InferenceService,
	token?: string,
) {
	const os = implement(inferenceContract);
	const router = os.router({
		health: os.health.handler(async () => ({
			available: await service.isAvailable(),
		})),
		offload: os.offload.handler(async () => {
			await service.offload();
			return {};
		}),
		tag: os.tag.handler(({ input }) => service.tag(input.file)),
		tagOppaiOracle: os.tagOppaiOracle.handler(({ input }) =>
			service.tagOppaiOracle(input.file),
		),
		ccipFeature: os.ccipFeature.handler(({ input }) =>
			service.ccipFeature(input.file),
		),
		ccipDifference: os.ccipDifference.handler(({ input }) =>
			service.ccipDifference(input.feature1, input.feature2),
		),
		ccipDistances: os.ccipDistances.handler(({ input }) =>
			service.ccipDistances(input.feature, input.candidates),
		),
		embeddingImage: os.embeddingImage.handler(({ input }) =>
			service.embeddingImage(input.file),
		),
		embeddingText: os.embeddingText.handler(({ input }) =>
			service.embeddingText(input.text),
		),
		detectAndCropCharacters: os.detectAndCropCharacters.handler(({ input }) =>
			service.detectAndCropCharacters(input.file, input.transparent),
		),
	});
	const handler = new OpenAPIHandler(router, {
		interceptors: [
			async (options) => {
				const procedure = options.path[0];
				if (procedure === "health") return options.next();
				try {
					return await service.run(options.request.signal, () =>
						options.next(),
					);
				} catch (err) {
					if (err instanceof ORPCError) throw err;
					logger.error({ err, procedure }, "Inference request failed");
					throw new ORPCError("UNPROCESSABLE_CONTENT", {
						message: "Inference failed",
					});
				}
			},
		],
	});
	const credential = token ? Buffer.from(`Bearer ${token}`) : undefined;
	return async (request: Request): Promise<Response> => {
		// Only the application should submit inference requests, including from loopback.
		if (request.headers.has("origin"))
			return new Response(null, { status: 403 });
		if (credential) {
			const authorization = Buffer.from(
				request.headers.get("authorization") ?? "",
			);
			if (
				credential.length !== authorization.length ||
				!timingSafeEqual(credential, authorization)
			) {
				return new Response(null, { status: 401 });
			}
		}
		const { response } = await handler.handle(request, { prefix: API_PREFIX });
		return response ?? new Response(null, { status: 404 });
	};
}

import { AiProviderSchema } from "@solid-imager/core/config";
import { z } from "zod";
import { createInferenceHandler } from "./http-handler";
import { createInferenceService } from "./inference-service";
import { logger } from "./logger";

const config = z
	.object({
		INFERENCE_HOST: z.string().default("127.0.0.1"),
		INFERENCE_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
		INFERENCE_PROVIDER: AiProviderSchema.default("auto"),
		INFERENCE_DEVICE: z.string().optional(),
		INFERENCE_TOKEN: z.string().optional(),
	})
	.parse(process.env);

const service = createInferenceService({
	provider: config.INFERENCE_PROVIDER,
	device: config.INFERENCE_DEVICE,
});
const server = Bun.serve({
	hostname: config.INFERENCE_HOST,
	port: config.INFERENCE_PORT,
	maxRequestBodySize: 104 * 1024 * 1024,
	idleTimeout: 0,
	fetch: createInferenceHandler(service, config.INFERENCE_TOKEN),
});
logger.info(
	{ address: server.url.href, provider: config.INFERENCE_PROVIDER },
	"Inference service listening",
);

async function shutdown() {
	await server.stop();
	await service.stop();
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());

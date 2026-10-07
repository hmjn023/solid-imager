import type { TaggingServiceDeps } from "@solid-imager/application/services/tagging-service";
import { TaggingServiceImpl } from "@solid-imager/application/services/tagging-service";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";

export { TaggingServiceImpl } from "@solid-imager/application/services/tagging-service";

async function readFileBuffer(filePath: string): Promise<ArrayBuffer> {
	return await Bun.file(filePath).arrayBuffer();
}

let _taggingService: TaggingServiceImpl | null = null;

const getTaggingService = () => {
	if (!_taggingService) {
		const deps: TaggingServiceDeps = {
			processingStateRepo: MediaProcessingStateRepository,
			transactionManager: DrizzleTransactionManager,
			jobRepo: services.getJobRepository(),
			aiClient: services.getAiClient(),
			sourceRepo: services.getSourceRepository(),
			mediaRepo: services.getMediaRepository(),
			tagRepo: services.getTagRepository(),
			characterRepo: services.getCharacterRepository(),
			ipRepo: services.getIpRepository(),
			logger,
			publishSourceEvent: (mediaSourceId, eventType, data) =>
				RealtimeEventBus.publishSource(mediaSourceId, eventType, data),
			readFileBuffer,
		};
		_taggingService = new TaggingServiceImpl(deps);
	}
	return _taggingService;
};

export const taggingService = new Proxy({} as TaggingServiceImpl, {
	get(_target, prop) {
		const service = getTaggingService();
		const value = service[prop as keyof TaggingServiceImpl];
		return typeof value === "function" ? value.bind(service) : value;
	},
});

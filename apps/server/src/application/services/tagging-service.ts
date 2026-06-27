import type { TaggingServiceDeps } from "@solid-imager/application/services/tagging-service";
import { TaggingServiceImpl } from "@solid-imager/application/services/tagging-service";
import { services } from "~/application/registry";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

export { TaggingServiceImpl } from "@solid-imager/application/services/tagging-service";

async function readFileBuffer(filePath: string): Promise<ArrayBuffer> {
	return await Bun.file(filePath).arrayBuffer();
}

let _taggingService: TaggingServiceImpl | null = null;

const getTaggingService = () => {
	if (!_taggingService) {
		const deps: TaggingServiceDeps = {
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

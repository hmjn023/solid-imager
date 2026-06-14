import type { TaggingServiceDeps } from "@solid-imager/application/services/tagging-service";
import { TaggingServiceImpl } from "@solid-imager/application/services/tagging-service";
import { services } from "~/application/registry";
import { SseManager } from "~/infrastructure/jobs/sse-manager";

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
			sseSendEvent: (mediaSourceId: string, eventType: string, data: unknown) =>
				SseManager.sendEvent(mediaSourceId, eventType, data),
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

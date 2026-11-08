import {
	type ITaggingService,
	type TaggingServiceDeps,
	createTaggingService,
} from "@solid-imager/application/tagging";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { resolveVideoThumbnail } from "./video-thumbnail";

async function readFileBuffer(filePath: string): Promise<ArrayBuffer> {
	return await Bun.file(filePath).arrayBuffer();
}

let _taggingService: ITaggingService | null = null;

const getTaggingService = () => {
	if (!_taggingService) {
		const deps: TaggingServiceDeps = {
			transactionManager: DrizzleTransactionManager,
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
			resolveVideoThumbnail,
		};
		_taggingService = createTaggingService(deps);
	}
	return _taggingService;
};

export const taggingService = new Proxy({} as ITaggingService, {
	get(_target, prop) {
		const service = getTaggingService();
		const value = service[prop as keyof ITaggingService];
		return typeof value === "function" ? value.bind(service) : value;
	},
});

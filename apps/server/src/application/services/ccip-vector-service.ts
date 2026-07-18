import type { ILogger } from "@solid-imager/application/ports/media-service";
import { CcipVectorService } from "@solid-imager/application/services/ccip-vector-service";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { PostgresCcipVectorStore } from "~/infrastructure/ai/postgres-ccip-vector-store";
import { db } from "~/infrastructure/db";

let service: CcipVectorService | null = null;
let configuredLogger: ILogger | undefined;

export function configureCcipVectorService(logger: ILogger): void {
	configuredLogger = logger;
}

export function getCcipVectorService(): CcipVectorService {
	if (!service) {
		service = new CcipVectorService({
			mediaRepository: services.getMediaRepository(),
			sourceRepository: services.getSourceRepository(),
			taggingService,
			vectorStore: new PostgresCcipVectorStore(db, configuredLogger),
			logger: configuredLogger,
		});
	}
	return service;
}

export const ccipVectorService = new Proxy({} as CcipVectorService, {
	get(_target, property) {
		const instance = getCcipVectorService();
		const value = instance[property as keyof CcipVectorService];
		return typeof value === "function" ? value.bind(instance) : value;
	},
});

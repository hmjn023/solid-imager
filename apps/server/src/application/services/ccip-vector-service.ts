import { CcipVectorService } from "@solid-imager/application/services/ccip-vector-service";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { LanceDbCcipVectorStore } from "~/infrastructure/ai/lancedb-ccip-vector-store";

let service: CcipVectorService | null = null;

export function getCcipVectorService(): CcipVectorService {
	if (!service) {
		const config = services.getConfigService().getConfig();
		service = new CcipVectorService({
			mediaRepository: services.getMediaRepository(),
			sourceRepository: services.getSourceRepository(),
			taggingService,
			vectorStore: new LanceDbCcipVectorStore(config.lancedb.ccipVectorDir),
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

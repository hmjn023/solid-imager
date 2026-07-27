import type { ILogger } from "@solid-imager/application/ports/media-service";
import { CcipVectorService } from "@solid-imager/application/services/ccip-vector-service";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { PostgresCcipVectorStore } from "~/infrastructure/ai/postgres-ccip-vector-store";
import { LanceDbCcipVectorStore } from "~/infrastructure/ai/lancedb-ccip-vector-store";
import { DualWriteCcipVectorStore } from "~/infrastructure/ai/dual-write-ccip-vector-store";
import { db } from "~/infrastructure/db";

let service: CcipVectorService | null = null;
let configuredLogger: ILogger | undefined;

export function configureCcipVectorService(logger: ILogger): void {
	configuredLogger = logger;
}

export function getCcipVectorService(): CcipVectorService {
	if (!service) {
		const config = services.getConfigService().getConfig();
		const postgresStore = new PostgresCcipVectorStore(db, configuredLogger);
		const legacyLanceStore = new LanceDbCcipVectorStore(
			config.lancedb.ccipVectorDir,
			{ legacy: true },
		);
		const rollbackStore = new LanceDbCcipVectorStore(
			config.lancedb.ccipRollbackDir,
			{ readOnly: config.lancedb.ccipStoreMode === "lance-readonly" },
		);
		const vectorStore = (() => {
			switch (config.lancedb.ccipStoreMode) {
				case "lance":
					return legacyLanceStore;
				case "postgres":
					return postgresStore;
				case "postgres-dual-write":
					return new DualWriteCcipVectorStore(
						postgresStore,
						[
							{ name: "postgres", store: postgresStore },
							{ name: "lance-rollback", store: rollbackStore },
						],
						configuredLogger,
					);
				case "lance-dual-write":
					return new DualWriteCcipVectorStore(
						rollbackStore,
						[
							{ name: "lance-rollback", store: rollbackStore },
							{ name: "postgres", store: postgresStore },
						],
						configuredLogger,
					);
				case "lance-readonly":
					return rollbackStore;
			}
		})();
		service = new CcipVectorService({
			mediaRepository: services.getMediaRepository(),
			sourceRepository: services.getSourceRepository(),
			taggingService,
			vectorStore,
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

import { ImportRequestService } from "@solid-imager/application/services/import-request-service";
import { createImportRequestRepository } from "@solid-imager/db/repositories/import-request-repository";
import { getExecutor } from "~/infrastructure/db/executor";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { services } from "~/infrastructure/service-registry";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { downloadRunService } from "./download-run-service";

export function getImportRequestService() {
	return new ImportRequestService({
		repo: createImportRequestRepository(getExecutor),
		transactions: DrizzleTransactionManager,
		sources: services.getSourceRepository(),
		logger,
		prepareReservation: () => downloadRunService.initialize(),
		reserve: async (sourceId, requests, tx) => {
			const items = requests.map((request) => {
				if (!request.item) throw new Error("Pending import has no input");
				return { ...request.item, importRequestId: request.id };
			});
			await queueDownloadJobs(sourceId, items, tx);
		},
		notify: (event) => RealtimeEventBus.publishImport(event.event, event.data),
	});
}

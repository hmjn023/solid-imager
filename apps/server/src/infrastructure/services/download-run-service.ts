import { DownloadRunService } from "@solid-imager/application/services/download-run-service";
import { DownloadRunRepository } from "~/infrastructure/repositories/download-run-repository";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
export const downloadRunService = new DownloadRunService({
	repo: DownloadRunRepository,
	transactions: DrizzleTransactionManager,
	alreadyStored: async (urls, tx) =>
		(await MediaRepository.findMediaIdWithMatchingUrlSet(urls, tx)) !== null,
	notify: (event) => RealtimeEventBus.publishJob(event.event, event.data),
	logger,
});

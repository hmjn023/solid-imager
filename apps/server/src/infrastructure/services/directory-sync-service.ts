import { services } from "~/infrastructure/service-registry";
import { sourceRunService } from "./source-run-service";

/** Source operation state and serialization are durable; notifications are advisory. */
export const DirectorySyncService = {
	syncMediaSource: (sourceId: string) =>
		sourceRunService.syncMediaSource(sourceId),
	async syncAllLocalSources() {
		const results = [];
		for (const source of await services.getSourceRepository().findAll()) {
			if (source.type === "local")
				results.push(await this.syncMediaSource(source.id));
		}
		return results;
	},
};

import { implement } from "@orpc/server";
import { configContract } from "@solid-imager/core/domain/contract/config.contract";
import { services } from "~/infrastructure/service-registry";

const os = implement(configContract);

export const configRouter = os.router({
	get: os.get.handler(async () => services.getConfigService().getConfig()),

	update: os.update.handler(async ({ input }) => {
		await services.getConfigService().updateConfig(input);
		return services.getConfigService().getConfig();
	}),
});

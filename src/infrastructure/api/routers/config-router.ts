import { os } from "@orpc/server";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import { services } from "~/application/registry";

export const configRouter = {
  get: os
    .output(AppConfigSchema)
    .handler(async () => services.getConfigService().getConfig()),

  update: os
    .input(AppConfigSchema.partial())
    .output(AppConfigSchema)
    .handler(async ({ input }) => {
      await services.getConfigService().updateConfig(input);
      return services.getConfigService().getConfig();
    }),
};

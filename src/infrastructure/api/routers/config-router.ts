import { os } from "@orpc/server";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import { services } from "~/application/registry";

export const configRouter = {
  get: os
    .output(AppConfigSchema)
    .handler(async () => services.getConfigService().get()),

  update: os
    .input(AppConfigSchema.partial())
    .output(AppConfigSchema)
    .handler(
      async ({ input }) => await services.getConfigService().update(input)
    ),
};

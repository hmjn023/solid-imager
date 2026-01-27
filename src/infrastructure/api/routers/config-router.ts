import { os } from "@orpc/server";
import { services } from "~/application/registry";
import { AppConfigSchema } from "~/domain/config/config-schema";

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

import { os } from "@orpc/server";
import { services } from "~/application/registry";
import { AppConfigSchema } from "~/domain/config/config-schema";

export const configRouter = os.router({
  get: os
    .contract({
      output: AppConfigSchema,
    })
    .handler(async () => services.getConfigService().get()),

  update: os
    .contract({
      input: AppConfigSchema.deepPartial(),
      output: AppConfigSchema,
    })
    .handler(
      async ({ input }) => await services.getConfigService().update(input)
    ),
});

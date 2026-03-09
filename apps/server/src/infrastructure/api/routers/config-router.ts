import { os } from "@orpc/server";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import { services } from "~/application/registry";

export const configRouter = {
  get: os.output(AppConfigSchema).handler(() => {
    const config = services.getConfigService().getConfig();
    // Clone config to scrub api keys before sending to frontend
    const safeConfig = JSON.parse(JSON.stringify(config)) as typeof config;
    if (safeConfig.sync?.servers) {
      for (const server of safeConfig.sync.servers) {
        if (server.apiKey) {
          server.apiKey = "***"; // Masked for frontend
        }
      }
    }
    return safeConfig;
  }),

  update: os
    .input(AppConfigSchema.partial())
    .output(AppConfigSchema)
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handling sync apiKey scrub/restore logic
    .handler(async ({ input }) => {
      // If the frontend sends back "***", we need to preserve the original apiKey
      if (input.sync?.servers) {
        const currentConfig = services.getConfigService().getConfig();
        for (const server of input.sync.servers) {
          if (server.apiKey === "***") {
            const existingServer = currentConfig.sync.servers.find(
              (s) => s.id === server.id
            );
            if (existingServer) {
              server.apiKey = existingServer.apiKey;
            } else {
              server.apiKey = undefined;
            }
          }
        }
      }

      await services.getConfigService().updateConfig(input);

      const newConfig = services.getConfigService().getConfig();
      const safeConfig = JSON.parse(
        JSON.stringify(newConfig)
      ) as typeof newConfig;
      if (safeConfig.sync?.servers) {
        for (const server of safeConfig.sync.servers) {
          if (server.apiKey) {
            server.apiKey = "***";
          }
        }
      }
      return safeConfig;
    }),
};

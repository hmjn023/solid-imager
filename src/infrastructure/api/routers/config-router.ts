import { Elysia } from "elysia";
import { services } from "~/application/registry";
import { logger } from "~/infrastructure/logger";

export const configRouter = new Elysia({ prefix: "/api/config" })
  .get("/", () => services.getConfigService().get())
  .post("/", async ({ body, set }) => {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: Config update payload is validated by service
      const updated = await services.getConfigService().update(body as any);
      return updated;
    } catch (error) {
      logger.error({ err: error }, "Failed to update config");
      // biome-ignore lint/style/noMagicNumbers: HTTP Status Code
      set.status = 400;
      return {
        error: error instanceof Error ? error.message : "Invalid configuration",
      };
    }
  });

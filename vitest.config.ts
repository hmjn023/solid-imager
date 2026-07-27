import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/cli/vitest.config.ts",
      "apps/server/vitest.unit.config.ts",
      "apps/server/vitest.integration.config.ts",
      "packages/core/vitest.config.ts",
      "packages/ui/vitest.config.ts",
    ],
  },
});

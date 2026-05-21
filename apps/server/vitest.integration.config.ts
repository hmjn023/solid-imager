import path from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
      "@": path.resolve(__dirname, "../../packages/core/src"),
      "@solid-imager/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup-integration.ts"],
    include: ["src/tests/integration/**/*.test.ts"],
    exclude: ["node_modules/**"],
    // Integration tests use real DB, so run sequentially
    sequence: {
      hooks: "stack",
    },
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DB_HOST: "pglite",
    },
  },
});

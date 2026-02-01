
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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

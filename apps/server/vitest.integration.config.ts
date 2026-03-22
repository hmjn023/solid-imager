import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // @ts-expect-error: Vite version mismatch in Vitest/Vinxi
  plugins: [tsconfigPaths()],
  test: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
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

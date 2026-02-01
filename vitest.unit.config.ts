
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup-unit.ts"],
    include: [
      "src/tests/unit/**/*.test.ts",
      "src/tests/api/**/*.test.ts",
      "src/tests/routes/**/*.test.ts",
    ],
    exclude: ["node_modules/**"],
  },
});

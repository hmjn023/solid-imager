import path from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup-unit.ts"],
    include: [
      "src/tests/unit/**/*.test.ts",
      "src/tests/api/**/*.test.ts",
      "src/tests/routes/**/*.test.ts",
    ],
    exclude: ["node_modules/**"],
    passWithNoTests: true,
  },
});

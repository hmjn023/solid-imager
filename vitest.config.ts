import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    exclude: ['**/*.spec.ts', 'src/tests/e2e/**', 'node_modules/**'],
    // 統合テストを順次実行（実際のDBを使用するため）
    sequence: {
      hooks: 'stack',
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});

import path from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    exclude: ["**/*.spec.ts", "src/tests/e2e/**", "node_modules/**"],
    // 統合テストを順次実行（実際のDBを使用するため）
    sequence: {
      hooks: "stack",
    },
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // テスト環境では必ずPGliteを使用
    env: {
      DB_HOST: "pglite",
    },
  },
});

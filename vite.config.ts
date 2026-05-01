import { defineConfig } from "vite-plus";

export default defineConfig({
	staged: {
		"*.{ts,tsx,js,jsx,json}": "biome check --fix --unsafe",
		"apps/server/src/**/*.{ts,tsx}": () => "bun run --cwd apps/server typecheck",
		"packages/core/src/**/*.{ts,tsx}": () => "bun run --cwd packages/core typecheck",
		"packages/ui/src/**/*.{ts,tsx}": () => "bun run --cwd packages/ui typecheck",
		"apps/tauri/src/**/*.{ts,tsx}": () => "bun run --cwd apps/tauri typecheck",
		"apps/xtracter/src/**/*.{ts,tsx}": () => "bun run --cwd apps/xtracter typecheck",
	},
});

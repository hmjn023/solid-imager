import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import solidPlugin from "@solidjs/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [solidPlugin(), tailwindcss()],
	optimizeDeps: {
		exclude: ["@ui-sdk/core"],
		include: [
			"@tanstack/solid-hotkeys",
			"@tanstack/solid-query",
			"@tanstack/virtual-core",
			"zod",
		],
	},
	resolve: {
		tsconfigPaths: true,
		dedupe: ["solid-js", "@solidjs/web"],
	},
	test: {
		attachmentsDir: "./test-results/browser",
		// Keep vite-plugin-solid from selecting jsdom for Vitest's Node preflight.
		environment: "node",
		include: ["src/**/*.browser.test.tsx"],
		setupFiles: ["./src/tests/browser.setup.ts"],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
});

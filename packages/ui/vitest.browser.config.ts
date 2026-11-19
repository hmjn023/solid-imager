import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import solidPlugin from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [solidPlugin(), tailwindcss()],
	optimizeDeps: {
		include: ["@tanstack/solid-query", "@tanstack/solid-virtual"],
	},
	resolve: {
		tsconfigPaths: true,
		dedupe: ["solid-js", "solid-js/web"],
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

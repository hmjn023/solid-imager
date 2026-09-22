import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_GALLERY_PORT;
if (!port) {
	throw new Error(
		"Use bun run test:e2e:components to allocate an isolated port.",
	);
}

// These tests run a Vite component fixture, with no app server, DB or native AI.
// Running the same fixture again under E2E_MODE=production adds no coverage.
export default defineConfig({
	testDir: "./src/tests/e2e",
	testMatch: "**/*.gallery.spec.ts",
	forbidOnly: true,
	workers: 1,
	retries: 0,
	timeout: 120_000,
	expect: { timeout: 15_000 },
	outputDir: "test-results/components",
	reporter: [
		["line"],
		["html", { open: "never", outputFolder: "playwright-report/components" }],
		["json", { outputFile: "test-results/components/results.json" }],
	],
	use: {
		...devices["Desktop Chrome"],
		viewport: { width: 1440, height: 900 },
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		actionTimeout: 10_000,
		navigationTimeout: 30_000,
	},
	// Preserve the existing screenshot baseline's project suffix.
	projects: [{ name: "desktop" }],
	webServer: {
		command: `bun x vite dev --config src/tests/e2e/ui-gallery/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
		url: `http://127.0.0.1:${port}`,
		reuseExistingServer: false,
		timeout: 120_000,
		gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
	},
});

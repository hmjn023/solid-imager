import { defineConfig, devices } from "@playwright/test";

type E2eMode = "dev" | "production";

function getE2eMode(): E2eMode {
	const mode = process.env.E2E_MODE;
	if (mode === "dev" || mode === "production") {
		return mode;
	}
	throw new Error(
		"E2E_MODE must be set to dev or production. Use bun run test:e2e:dev, test:e2e:production, or test:e2e.",
	);
}

function getEnvironment(): Record<string, string> {
	return Object.fromEntries(
		Object.entries(process.env).flatMap(([key, value]) =>
			value === undefined ? [] : [[key, value]],
		),
	);
}

const mode = getE2eMode();
const runtimeDir = process.env.E2E_RUNTIME_DIR;
const port = process.env.E2E_PORT;

if (!(runtimeDir && port)) {
	throw new Error(
		"E2E_RUNTIME_DIR and E2E_PORT must be set by the isolated E2E runner.",
	);
}

const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: "./src/tests/e2e",
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	workers: 1,
	timeout: 120_000,
	expect: {
		timeout: 15_000,
	},
	reporter: [["line"], ["html", { open: "never" }]],
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		actionTimeout: 10_000,
		navigationTimeout: 30_000,
	},
	projects: [
		{
			name: "desktop",
			testIgnore: "**/*.responsive.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
			},
		},
		{
			name: "responsive-desktop",
			testMatch: "**/*.responsive.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
			},
		},
		{
			name: "responsive-320",
			testMatch: "**/*.responsive.spec.ts",
			use: {
				...devices["Pixel 5"],
				viewport: { width: 320, height: 720 },
				isMobile: true,
				hasTouch: true,
			},
		},
		{
			name: "responsive-375",
			testMatch: "**/*.responsive.spec.ts",
			use: {
				...devices["Pixel 5"],
				viewport: { width: 375, height: 812 },
				isMobile: true,
				hasTouch: true,
			},
		},
		{
			name: "responsive-768",
			testMatch: "**/*.responsive.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 768, height: 1024 },
				hasTouch: true,
			},
		},
	],
	webServer: {
		command: "bun scripts/e2e-server.ts",
		cwd: process.cwd(),
		env: {
			...getEnvironment(),
			E2E: "1",
			E2E_MODE: mode,
			E2E_PORT: port,
			E2E_RUNTIME_DIR: runtimeDir,
		},
		url: baseURL,
		timeout: mode === "production" ? 240_000 : 120_000,
		reuseExistingServer: false,
		gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
		stdout: "pipe",
		stderr: "pipe",
	},
});

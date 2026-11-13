import { join, matchesGlob } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { readPlaywrightSelection } from "./scripts/e2e-arguments";

type E2eMode = "dev" | "production";

function getE2eMode(): E2eMode {
	const mode = process.env.E2E_MODE;
	if (mode === "dev" || mode === "production") {
		return mode;
	}
	throw new Error(
		"E2E_MODE must be set to dev or production. Use bun run test:e2e.",
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
const tauriPort = process.env.E2E_TAURI_PORT;

if (!(runtimeDir && port)) {
	throw new Error(
		"E2E_RUNTIME_DIR and E2E_PORT must be set by the isolated E2E runner.",
	);
}

const baseURL = `http://127.0.0.1:${port}`;
const tauriBaseURL = tauriPort ? `http://127.0.0.1:${tauriPort}` : undefined;
const resolvedTauriBaseURL = tauriBaseURL ?? baseURL;
const tauriSpecs = [
	"tauri-migration.spec.ts",
	"search-workspace.spec.ts",
	"danbooru.responsive.spec.ts",
	"pixiv.responsive.spec.ts",
];

function needsTauriFixture(args: string[]): boolean {
	const { projects, files } = readPlaywrightSelection(args);
	if (
		projects.length &&
		!projects.some((name) => matchesGlob("tauri", name.toLowerCase()))
	)
		return false;
	return (
		!files.length ||
		files.some((filter) => {
			// Positional filters are regular expressions, including partial file names.
			// Only skip the fixture for simple spec paths we can rule out.
			const file = /^([\w./-]+\.spec\.ts)(?::\d+(?::\d+)?)?$/i.exec(
				filter,
			)?.[1];
			if (!file) return true;
			const pattern = new RegExp(file, "i");
			return tauriSpecs.some((spec) =>
				pattern.test(join(import.meta.dirname, "src/tests/e2e", spec)),
			);
		})
	);
}

const shouldStartTauriFixture = needsTauriFixture(process.argv.slice(3));

if (shouldStartTauriFixture && !tauriBaseURL) {
	throw new Error(
		"E2E_TAURI_PORT must be set when running the Tauri E2E fixture.",
	);
}

export default defineConfig({
	globalSetup: "./src/tests/e2e/support/wait-for-source-sync.ts",
	grep: process.env.E2E_DEV_SMOKE === "1" ? /@dev-smoke/ : undefined,
	testDir: "./src/tests/e2e",
	testIgnore: ["**/*.gallery.spec.ts"],
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	workers: 1,
	timeout: 120_000,
	expect: {
		timeout: 15_000,
	},
	outputDir: `test-results/${mode}`,
	reporter: [
		["line"],
		["html", { open: "never", outputFolder: `playwright-report/${mode}` }],
		["json", { outputFile: `test-results/${mode}/results.json` }],
	],
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
			name: "tauri",
			testMatch: tauriSpecs.map((spec) => `**/${spec}`),
			use: {
				...devices["Desktop Chrome"],
				baseURL: resolvedTauriBaseURL,
				viewport: { width: 1600, height: 900 },
			},
		},
		{
			name: "desktop",
			testIgnore: [
				"**/*.responsive.spec.ts",
				"**/tauri-migration.spec.ts",
				"**/*.gallery.spec.ts",
			],
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
			},
		},
		{
			name: "responsive-desktop",
			grepInvert: /@mobile-only/,
			testMatch: "**/*.responsive.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
			},
		},
		{
			name: "responsive-320",
			grepInvert: /@desktop-only/,
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
			grepInvert: /@desktop-only/,
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
			grepInvert: /@(?:desktop|mobile)-only/,
			testMatch: "**/*.responsive.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 768, height: 1024 },
				hasTouch: true,
			},
		},
	],
	webServer: [
		{
			command: "bun scripts/e2e-server.ts",
			cwd: process.cwd(),
			env: {
				...getEnvironment(),
				REST_PUBLIC_ORIGIN: "https://imager.example.test",
				E2E: "1",
				E2E_MODE: mode,
				E2E_PORT: port,
				E2E_RUNTIME_DIR: runtimeDir,
			},
			url: mode === "dev" ? `${baseURL}/__e2e_ready` : baseURL,
			timeout: mode === "production" ? 240_000 : 120_000,
			reuseExistingServer: false,
			gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
			stdout: "pipe",
			stderr: "pipe",
		},
		...(shouldStartTauriFixture
			? [
					{
						command:
							mode === "dev"
								? `bun x vite dev --config src/tests/e2e/tauri-app/vite.config.ts --host 127.0.0.1 --port ${tauriPort} --strictPort`
								: "bun src/tests/e2e/tauri-app/serve-production.ts",
						cwd: process.cwd(),
						env: {
							...getEnvironment(),
							E2E: "1",
							E2E_MODE: mode,
							E2E_PORT: port,
							E2E_RUNTIME_DIR: runtimeDir,
						},
						url: resolvedTauriBaseURL,
						timeout: mode === "production" ? 240_000 : 120_000,
						reuseExistingServer: false,
						gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
						stdout: "pipe" as const,
						stderr: "pipe" as const,
					},
				]
			: []),
	],
});

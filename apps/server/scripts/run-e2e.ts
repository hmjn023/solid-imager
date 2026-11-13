import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPlaywrightSelection } from "./e2e-arguments";

type E2eMode = "dev" | "production" | "components";

const appRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const runtimeRoot = path.join(tmpdir(), "solid-imager-e2e");
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
	console.log(`bun run test:e2e [--mode=smoke|dev|production|components|full] [Playwright options or spec]

Default: dev smoke tests, then the full production suite. Explicit filters run in both.
  --mode=smoke        Tagged dev smoke cases only
  --mode=dev          Dev only (all matching app tests)
  --mode=production   Fresh production build only
  --mode=components   Component gallery only (no app server or DB)
  --mode=full         All matching app tests in both dev and production
  --list              List the selected tests without starting servers

Example: bun run test:e2e --mode=dev route-reload.spec.ts`);
	process.exit(0);
}

let requestedMode: E2eMode | "full" | "smoke" | undefined;
const playwrightArguments: string[] = [];
for (let index = 0; index < args.length; index++) {
	const argument = args[index];
	if (argument === "--mode" || argument.startsWith("--mode=")) {
		const mode = argument === "--mode" ? args[++index] : argument.slice(7);
		if (
			mode !== "smoke" &&
			mode !== "dev" &&
			mode !== "production" &&
			mode !== "components" &&
			mode !== "full"
		) {
			throw new Error(
				"--mode must be smoke, dev, production, components, or full",
			);
		}
		if (requestedMode) throw new Error("Specify --mode once");
		requestedMode = mode;
	} else {
		playwrightArguments.push(argument);
	}
}
// Accept the package-script separator before a spec or Playwright options.
if (playwrightArguments[0] === "--") playwrightArguments.shift();
const { hasSelection, listOnly } = readPlaywrightSelection(playwrightArguments);

async function findAvailablePort(): Promise<string> {
	return await new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen({ host: "127.0.0.1", port: 0 }, () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Failed to allocate an E2E port"));
				return;
			}
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(String(address.port));
			});
		});
	});
}

async function createEnvironment(
	mode: E2eMode,
	runtimeDir: string,
): Promise<Record<string, string>> {
	const inherited = Object.fromEntries(
		Object.entries(process.env).flatMap(([key, value]) =>
			value === undefined ? [] : [[key, value]],
		),
	);
	const portNames =
		mode === "components"
			? ["E2E_GALLERY_PORT"]
			: ["E2E_PORT", "E2E_HMR_PORT", "E2E_TAURI_PORT", "E2E_TAURI_HMR_PORT"];
	// Playwright collects specs without launching webServer in list mode.
	const ports = await Promise.all(
		portNames.map(
			async (name) =>
				[name, listOnly ? "0" : await findAvailablePort()] as const,
		),
	);
	return {
		...inherited,
		E2E_MODE: mode,
		...Object.fromEntries(ports),
		E2E_RUNTIME_DIR: runtimeDir,
	};
}

async function runMode(mode: E2eMode, devSmoke: boolean): Promise<void> {
	const runtimeDir = path.join(runtimeRoot, `${mode}-${randomUUID()}`);
	const environment = await createEnvironment(mode, runtimeDir);
	console.error(`E2E ${mode}${devSmoke ? " (@dev-smoke)" : ""}`);
	const childProcess = Bun.spawn(
		[
			process.execPath,
			"run",
			"playwright",
			"test",
			...(mode === "components"
				? ["--config=playwright.components.config.ts"]
				: []),
			...playwrightArguments,
		],
		{
			cwd: appRoot,
			env: { ...environment, E2E_DEV_SMOKE: devSmoke ? "1" : "0" },
			stdout: "inherit",
			stderr: "inherit",
			stdin: "inherit",
		},
	);
	const exitCode = await childProcess.exited;
	if (exitCode !== 0) {
		console.error(
			mode === "components"
				? "Component tests failed. See test-results/components and playwright-report/components."
				: `E2E ${mode} failed. Runtime data kept at ${runtimeDir}\nServer/build log: ${path.join(runtimeDir, "server.log")}`,
		);
		process.exitCode = exitCode;
		return;
	}
	await rm(runtimeDir, { recursive: true, force: true });
}

const modes: E2eMode[] =
	!requestedMode || requestedMode === "full"
		? ["dev", "production"]
		: [requestedMode === "smoke" ? "dev" : requestedMode];

for (const mode of modes) {
	await runMode(
		mode,
		requestedMode === "smoke" ||
			(!requestedMode && mode === "dev" && !hasSelection),
	);
	if (process.exitCode) {
		break;
	}
}

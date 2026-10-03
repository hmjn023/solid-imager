import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	assertSafeRuntimeDir,
	prepareIsolatedRuntime,
} from "./isolated-runtime";
import { getE2eRuntimeDir } from "../src/tests/e2e/support/fixture";

type E2eMode = "dev" | "production";

const appRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const allowedRuntimeRoot = path.join(tmpdir(), "solid-imager-e2e");
const bunPreloadPath = path.join(appRoot, "scripts/e2e-bun-preload.ts");

function getMode(): E2eMode {
	const mode = process.env.E2E_MODE;
	if (mode === "dev" || mode === "production") {
		return mode;
	}
	throw new Error("E2E_MODE must be either 'dev' or 'production'");
}

function getPort(): string {
	const port = process.env.E2E_PORT;
	if (!port) {
		throw new Error("E2E_PORT must be set by the E2E runner");
	}
	return port;
}

function serverEnvironment(
	runtimeDir: string,
	routeTreePath: string,
): Record<string, string> {
	const inherited = Object.fromEntries(
		Object.entries(process.env).flatMap(([key, value]) => {
			if (value === undefined || key.startsWith("CONFIG_")) {
				return [];
			}
			return [[key, value]];
		}),
	);
	const runtimeNodePath = [
		path.join(appRoot, "node_modules"),
		inherited.NODE_PATH,
	]
		.filter((value): value is string => Boolean(value))
		.join(path.delimiter);
	const port = getPort();
	return {
		...inherited,
		E2E: "1",
		E2E_MODE: getMode(),
		E2E_PORT: port,
		E2E_RUNTIME_DIR: runtimeDir,
		E2E_ROUTE_TREE_PATH: routeTreePath,
		E2E_OUTPUT_DIR: path.join(runtimeDir, "output"),
		DB_HOST: "pglite",
		PGLITE_DATA_DIR: path.join(runtimeDir, "pglite"),
		CONFIG_PATH: path.join(runtimeDir, "config.json"),
		NITRO_HOST: "127.0.0.1",
		NITRO_PORT: port,
		PORT: port,
		NODE_PATH: runtimeNodePath,
	};
}

async function runCommand(
	command: string[],
	environment: Record<string, string>,
): Promise<void> {
	appendFileSync(serverLogPath, `\nStarting: ${command.join(" ")}\n`);
	const childProcess = Bun.spawn(command, {
		cwd: appRoot,
		env: environment,
		stdout: "pipe",
		stderr: "pipe",
		stdin: "inherit",
	});
	const output = Promise.all([
		forwardOutput(childProcess.stdout, process.stdout),
		forwardOutput(childProcess.stderr, process.stderr),
	]);
	let shutdownRequested = false;
	const stop = () => {
		shutdownRequested = true;
		childProcess.kill();
	};
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	const exitCode = await childProcess.exited;
	await output;
	process.off("SIGINT", stop);
	process.off("SIGTERM", stop);
	appendFileSync(
		serverLogPath,
		`Exited: ${exitCode} (shutdown requested: ${shutdownRequested})\n`,
	);
	if (exitCode !== 0 && !shutdownRequested) {
		throw new Error(
			`Command failed with exit code ${exitCode}: ${command.join(" ")}`,
		);
	}
	if (shutdownRequested) process.exit(exitCode);
}

async function forwardOutput(
	stream: ReadableStream<Uint8Array>,
	destination: NodeJS.WriteStream,
): Promise<void> {
	for await (const chunk of stream) {
		appendFileSync(serverLogPath, chunk);
		destination.write(chunk);
	}
}

async function startServer(
	mode: E2eMode,
	environment: Record<string, string>,
): Promise<void> {
	const outputDir = environment.E2E_OUTPUT_DIR;
	if (!outputDir) {
		throw new Error("E2E_OUTPUT_DIR must be set by the E2E runner");
	}
	if (mode === "production") {
		await runCommand([process.execPath, "run", "build"], environment);
	}

	await runCommand(
		mode === "dev"
			? [
					process.execPath,
					"--bun",
					`--preload=${bunPreloadPath}`,
					"run",
					"vite",
					"dev",
				]
			: [
					process.execPath,
					`--preload=${bunPreloadPath}`,
					path.join(outputDir, "server", "index.mjs"),
				],
		environment,
	);
}

const mode = getMode();
const runtimeDir = getE2eRuntimeDir();
assertSafeRuntimeDir(runtimeDir, allowedRuntimeRoot);
const serverLogPath = path.join(runtimeDir, "server.log");
try {
	const preparationStartedAt = new Date().toISOString();
	const { routeTreePath } = await prepareIsolatedRuntime(runtimeDir);
	appendFileSync(
		serverLogPath,
		`Prepared isolated ${mode} runtime (started ${preparationStartedAt})\n`,
	);
	await startServer(mode, serverEnvironment(runtimeDir, routeTreePath));
} catch (error) {
	try {
		mkdirSync(runtimeDir, { recursive: true });
		appendFileSync(
			serverLogPath,
			`${error instanceof Error ? error.stack : String(error)}\n`,
		);
	} catch {
		// Logging must not hide the original startup failure.
	}
	throw error;
}

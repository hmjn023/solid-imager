import { lstat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeRuntimeDir, prepareIsolatedRuntime } from "./isolated-runtime";
import { getE2eRuntimeDir } from "../src/tests/e2e/support/fixture";

type E2eMode = "dev" | "production";

const appRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const allowedRuntimeRoot = path.join(tmpdir(), "solid-imager-e2e");

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
	};
}

async function runCommand(
	command: string[],
	environment: Record<string, string>,
): Promise<void> {
	const childProcess = Bun.spawn(command, {
		cwd: appRoot,
		env: environment,
		stdout: "inherit",
		stderr: "inherit",
		stdin: "inherit",
	});
	const exitCode = await childProcess.exited;
	if (exitCode !== 0) {
		throw new Error(`Command failed with exit code ${exitCode}: ${command.join(" ")}`);
	}
}

async function linkProductionDependencies(outputDir: string): Promise<void> {
	// Nitro bundles most dependencies, but LanceDB dynamically resolves
	// apache-arrow at runtime. An output rooted in /tmp has no ancestor
	// node_modules directory, unlike the application's normal .output.
	const targetPath = path.join(outputDir, "node_modules");
	try {
		await lstat(targetPath);
		return;
	} catch (error) {
		if (
			typeof error !== "object" ||
			error === null ||
			!("code" in error) ||
			error.code !== "ENOENT"
		) {
			throw error;
		}
	}
	await symlink(
		path.join(appRoot, "node_modules"),
		targetPath,
		"dir",
	);
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
		await linkProductionDependencies(outputDir);
	}

	const childProcess = Bun.spawn(
		mode === "dev"
			? [process.execPath, "run", "dev"]
			: [process.execPath, path.join(outputDir, "server", "index.mjs")],
		{
			cwd: appRoot,
			env: environment,
			stdout: "inherit",
			stderr: "inherit",
			stdin: "inherit",
		},
	);
	let shutdownRequested = false;
	const stop = () => {
		shutdownRequested = true;
		childProcess.kill();
	};
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	const exitCode = await childProcess.exited;
	process.off("SIGINT", stop);
	process.off("SIGTERM", stop);
	if (exitCode !== 0 && !shutdownRequested) {
		throw new Error(`E2E ${mode} server exited with code ${exitCode}`);
	}
}

const mode = getMode();
const runtimeDir = getE2eRuntimeDir();
assertSafeRuntimeDir(runtimeDir, allowedRuntimeRoot);
const { routeTreePath } = await prepareIsolatedRuntime(runtimeDir);
await startServer(mode, serverEnvironment(runtimeDir, routeTreePath));

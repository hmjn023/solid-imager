import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RPCHandler } from "@orpc/server/node";
import { defineConfig } from "vite-plus";
import type { Plugin } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import solidPlugin from "vite-plugin-solid";
import { nitro } from "nitro/vite";
import { devtools } from "@tanstack/devtools-vite";
import mkcert from "vite-plugin-mkcert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isE2e = process.env.E2E === "1";
const isDevStartupMeasurement = process.env.DEV_STARTUP_MEASUREMENT === "1";
const defaultRouteTreePath = path.resolve(__dirname, "src/routeTree.gen.ts");

type IsolatedDevConfig = {
	port: number;
	hmrPort: number;
	runtimeDir: string;
	routeTreePath: string;
};

function getRequiredEnvironment(name: string, mode: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} must be set when ${mode}`);
	}
	return value;
}

function getPort(name: string, mode: string): number {
	const port = Number.parseInt(getRequiredEnvironment(name, mode), 10);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error(
			`${name} must be an integer between 1 and 65535 when ${mode}`,
		);
	}
	return port;
}

function getIsolatedDevConfig(): IsolatedDevConfig | undefined {
	if (!(isE2e || isDevStartupMeasurement)) {
		return undefined;
	}

	const prefix = isE2e ? "E2E" : "DEV_STARTUP";
	const mode = isE2e ? "E2E=1" : "DEV_STARTUP_MEASUREMENT=1";
	return {
		port: getPort(`${prefix}_PORT`, mode),
		hmrPort: getPort(`${prefix}_HMR_PORT`, mode),
		runtimeDir: path.resolve(getRequiredEnvironment(`${prefix}_RUNTIME_DIR`, mode)),
		routeTreePath: path.resolve(
			getRequiredEnvironment(`${prefix}_ROUTE_TREE_PATH`, mode),
		),
	};
}

const isolatedDevConfig = getIsolatedDevConfig();
const routeTreePath = isolatedDevConfig?.routeTreePath ?? defaultRouteTreePath;
const e2eNitroOutput = isE2e
	? (() => {
		const dir = path.resolve(getRequiredEnvironment("E2E_OUTPUT_DIR", "E2E=1"));
		return {
			dir,
			serverDir: path.join(dir, "server"),
			publicDir: path.join(dir, "public"),
		};
	})()
	: undefined;
const viteCacheDir = isolatedDevConfig
	? path.join(isolatedDevConfig.runtimeDir, "vite-cache")
	: undefined;
const routerTmpDir = isolatedDevConfig
	? path.join(isolatedDevConfig.runtimeDir, "tanstack-tmp")
	: undefined;
const workspaceRoot = path.resolve(__dirname, "../..");
const routeFileIgnorePattern = "^components$";
const shouldUseMkcert =
	!isE2e &&
	(!isDevStartupMeasurement || process.env.DEV_STARTUP_DISABLE_MKCERT !== "1");
const shouldUseDevtools =
	!isDevStartupMeasurement || process.env.DEV_STARTUP_DISABLE_DEVTOOLS !== "1";

type RuntimeImport = <TModule>(specifier: string) => Promise<TModule>;

// Keep these imports out of Vite config bundling; the server modules rely on Bun's runtime TS path resolution.
const runtimeImport = new Function(
	"specifier",
	"return import(specifier)",
) as RuntimeImport;

function serverModuleUrl(relativePath: string): string {
	return pathToFileURL(path.resolve(__dirname, relativePath)).href;
}

const bypassSecFetchDestPlugin = (): Plugin => ({
	name: "bypass-sec-fetch-dest",
	configureServer(server) {
		server.middlewares.use((req, _res, next) => {
			if (req.url?.startsWith("/api/")) {
				if (req.headers["sec-fetch-dest"] === "image") {
					req.headers["x-orig-sec-fetch-dest"] = req.headers["sec-fetch-dest"];
					delete req.headers["sec-fetch-dest"];
				}
			}
			next();
		});
	},
});

const loadDevRpcHandler = async () => {
	const [{ appRouter }, { initServices, startBackgroundWorker }, { logger }] =
		await Promise.all([
			runtimeImport<typeof import("./src/domain/shared/api-contract")>(
				serverModuleUrl("src/domain/shared/api-contract.ts"),
			),
			runtimeImport<typeof import("./src/infrastructure/bootstrap")>(
				serverModuleUrl("src/infrastructure/bootstrap.ts"),
			),
			runtimeImport<typeof import("./src/infrastructure/logger")>(
				serverModuleUrl("src/infrastructure/logger.ts"),
			),
		]);

	return {
		handler: new RPCHandler(appRouter),
		initServices,
		startBackgroundWorker,
		logger,
	};
};

let devRpcHandlerPromise: ReturnType<typeof loadDevRpcHandler> | undefined;
type DevRpcHandler = Awaited<ReturnType<typeof loadDevRpcHandler>>;

function getDevRpcHandler(): ReturnType<typeof loadDevRpcHandler> {
	devRpcHandlerPromise ??= loadDevRpcHandler();
	return devRpcHandlerPromise;
}

const devOrpcNodeMiddlewarePlugin = (): Plugin => ({
	name: "dev-orpc-node-middleware",
	apply: "serve",
	configureServer(server) {
		let backgroundWorkerStarted = false;
		let startBackgroundWorker: DevRpcHandler["startBackgroundWorker"] | undefined;
		let logger: DevRpcHandler["logger"] | undefined;

		const startBackgroundWorkerOnce = () => {
			if (backgroundWorkerStarted || !startBackgroundWorker) {
				return;
			}
			backgroundWorkerStarted = true;
			try {
				if (isDevStartupMeasurement) {
					logger?.info(
						"Dev startup measurement: matched RPC response finished",
					);
				}
				startBackgroundWorker();
			} catch (error) {
				backgroundWorkerStarted = false;
				logger?.error(
					{ err: error },
					"Failed to start background worker after dev RPC response",
				);
			}
		};

		server.middlewares.use(async (req, res, next) => {
			const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
			if (pathname !== "/api/rpc" && !pathname.startsWith("/api/rpc/")) {
				next();
				return;
			}

			try {
				const devRpcHandler = await getDevRpcHandler();
				logger = devRpcHandler.logger;
				const { handler, initServices } = devRpcHandler;
				startBackgroundWorker = devRpcHandler.startBackgroundWorker;
				initServices();

				let matched = false;
				let responseFinished = false;
				const startAfterSuccessfulResponse = () => {
					responseFinished = true;
					if (
						matched &&
						res.statusCode >= 200 &&
						res.statusCode < 300
					) {
						startBackgroundWorkerOnce();
					}
				};
				res.once("finish", startAfterSuccessfulResponse);

				const result = await handler.handle(req, res, {
					prefix: "/api/rpc",
					context: {},
				});
				matched = result.matched;
				if (
					matched &&
					responseFinished &&
					res.statusCode >= 200 &&
					res.statusCode < 300
				) {
					startBackgroundWorkerOnce();
				}

				if (!matched) {
					logger.warn(
						{ method: req.method, url: req.url },
						"Unmatched RPC request",
					);
					res.statusCode = 404;
					res.end("Not Found");
				}
			} catch (error) {
				logger?.error({ err: error }, "Dev RPC middleware failed");
				next(error);
			}
		});
	},
});

export default defineConfig({
	root: __dirname,
	cacheDir: viteCacheDir,
	server: isolatedDevConfig
		? {
			host: "127.0.0.1",
			port: isolatedDevConfig.port,
			strictPort: true,
			// Keep the dev-only transform and HMR client active while isolating
			// measurement and E2E runs from the developer server's sockets.
			hmr: {
				protocol: shouldUseMkcert ? "wss" : "ws",
				host: "127.0.0.1",
				port: isolatedDevConfig.hmrPort,
				clientPort: isolatedDevConfig.hmrPort,
			},
			fs: {
				allow: [workspaceRoot, path.dirname(routeTreePath)],
			},
		}
		: {
			hmr: {
				protocol: "wss",
				host: "localhost",
				port: 3001,
				clientPort: 3001,
			},
		},
	resolve: {
		alias: {
			"#route-tree": routeTreePath,
			"@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
			"@": path.resolve(__dirname, "../../packages/core/src"),
			"~": path.resolve(__dirname, "./src"),
		},
		tsconfigPaths: true,
	},
	plugins: [
		...(shouldUseMkcert ? [mkcert()] : []),
		bypassSecFetchDestPlugin(),
		devOrpcNodeMiddlewarePlugin(),
		...(shouldUseDevtools
			? [
				devtools({
					consolePiping: { enabled: false },
				}),
			]
			: []),
		nitro(
			e2eNitroOutput
				? {
					output: e2eNitroOutput,
				}
				: undefined,
		),
		tailwindcss(),
		tanstackStart({
			router: {
				// The generator matches each directory name, not its full path.
				routeFileIgnorePattern,
				// Start is the only route-tree and code-splitting plugin for this app.
				// Its output path is isolated above for E2E and measurements.
				generatedRouteTree: routeTreePath,
				enableRouteGeneration: true,
				tmpDir: routerTmpDir,
			},
		}),
		solidPlugin({ ssr: true }),
	],
	optimizeDeps: {
		exclude: ["bun", "dghs-imgutils-rs", "@lancedb/lancedb"],
	},
	customLogger: {
		warn(msg, options) {
			if (
				typeof msg === "string" &&
				msg.includes("externalized for browser compatibility")
			) {
				return;
			}
			console.warn(msg, options);
		},
		warnOnce(msg, options) {
			this.warn(msg, options);
		},
		info: console.info,
		error: console.error,
		clearScreen: () => {},
		hasWarned: false,
	},
	build: {
		rollupOptions: {
			external: [
				"bun",
				"dghs-imgutils-rs",
				"ffmpeg-static",
				"fluent-ffmpeg",
				"@electric-sql/pglite",
				"archiver",
				"@lancedb/lancedb",
				"apache-arrow",
				"sharp",
			],
		},
	},
	ssr: {
		noExternal: [
			"@tanstack/solid-router",
			"@tanstack/solid-query",
			"@tanstack/solid-start",
			"@kobalte/core",
			"solid-sonner",
			"corvu",
			"@solid-primitives/.*",
		],
		external: [
			"bun",
			"@electric-sql/pglite",
			"ffmpeg-static",
			"ffmpeg-static-static",
			"fluent-ffmpeg",
			"archiver",
			"@lancedb/lancedb",
			"apache-arrow",
			"dghs-imgutils-rs",
			"sharp",
		],
	},
});

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { API_PREFIX } from "@solid-imager/core/http";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import solidPlugin from "@solidjs/vite-plugin";
import { nitro } from "nitro/vite";
import { toNodeHandler } from "srvx/node";
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
		runtimeDir: path.resolve(
			getRequiredEnvironment(`${prefix}_RUNTIME_DIR`, mode),
		),
		routeTreePath: path.resolve(
			getRequiredEnvironment(`${prefix}_ROUTE_TREE_PATH`, mode),
		),
	};
}

const isolatedDevConfig = getIsolatedDevConfig();
const routeTreePath = isolatedDevConfig?.routeTreePath ?? defaultRouteTreePath;
const e2eNitroOutput = isE2e
	? (() => {
			const dir = path.resolve(
				getRequiredEnvironment("E2E_OUTPUT_DIR", "E2E=1"),
			);
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

async function loadDevApi() {
	if (isE2e)
		await runtimeImport(serverModuleUrl("scripts/e2e-external-viewer.ts"));
	const [
		{ handleApiRequest },
		{ initServices, startBackgroundWorker },
		{ logger },
	] = await Promise.all([
		runtimeImport<typeof import("./src/infrastructure/api/http-handler")>(
			serverModuleUrl("src/infrastructure/api/http-handler.ts"),
		),
		runtimeImport<typeof import("./src/infrastructure/bootstrap")>(
			serverModuleUrl("src/infrastructure/bootstrap.ts"),
		),
		runtimeImport<typeof import("./src/infrastructure/logger")>(
			serverModuleUrl("src/infrastructure/logger.ts"),
		),
	]);
	return {
		handle: toNodeHandler((request) => handleApiRequest(request, initServices)),
		initServices,
		startBackgroundWorker,
		logger,
	};
}

let devApiPromise: ReturnType<typeof loadDevApi> | undefined;

function getDevApi() {
	devApiPromise ??= loadDevApi();
	return devApiPromise;
}

const devApiMiddlewarePlugin = (): Plugin => ({
	name: "dev-api-middleware",
	apply: "serve",
	configureServer(server) {
		// Serve all API requests from one process so PGlite and Pixiv sessions
		// are shared with the worker, MCP, and the media routes.
		let workerStarted = false;
		server.middlewares.use(async (req, res, next) => {
			const { pathname } = new URL(req.url ?? "/", "http://localhost");
			if (pathname !== API_PREFIX && !pathname.startsWith(`${API_PREFIX}/`)) {
				next();
				return;
			}
			try {
				const api = await getDevApi();
				if (!workerStarted && pathname !== `${API_PREFIX}/health`) {
					res.once("finish", () => {
						if (workerStarted || res.statusCode < 200 || res.statusCode >= 300)
							return;
						try {
							api.startBackgroundWorker();
							workerStarted = true;
							if (isDevStartupMeasurement) {
								api.logger.info(
									"Dev startup measurement: matched API response finished",
								);
							}
						} catch (error) {
							api.logger.error(
								{ err: error },
								"Failed to start background worker after dev API response",
							);
						}
					});
				}
				await api.handle(req, res);
			} catch (error) {
				next(error);
			}
		});
	},
});

const e2eReadinessPlugin = (): Plugin => ({
	name: "e2e-readiness",
	apply: "serve",
	configureServer(server) {
		if (!isE2e) return;
		server.middlewares.use("/__e2e_ready", async (_req, res) => {
			try {
				const api = await getDevApi();
				api.initServices();
				api.startBackgroundWorker();

				const probeUrl = `http://127.0.0.1:${isolatedDevConfig?.port}/api/sources`;
				let lastProbeFailure =
					"SSR readiness probe did not return a successful response";
				for (let attempt = 0; attempt < 120; attempt += 1) {
					const controller = new AbortController();
					const timeout = setTimeout(() => controller.abort(), 5_000);
					try {
						const probeResponse = await fetch(probeUrl, {
							signal: controller.signal,
						});
						await probeResponse.text();
						if (probeResponse.ok) {
							res.statusCode = 200;
							res.end("ok");
							return;
						}
						lastProbeFailure = `SSR readiness probe returned ${probeResponse.status}`;
					} catch (error) {
						lastProbeFailure =
							error instanceof Error ? error.message : String(error);
					} finally {
						clearTimeout(timeout);
					}
					await new Promise((resolve) => setTimeout(resolve, 250));
				}

				res.statusCode = 503;
				res.end(lastProbeFailure);
				return;
			} catch (error) {
				res.statusCode = 503;
				res.end(
					error instanceof Error ? error.message : "E2E server is not ready",
				);
			}
		});
	},
});

const e2eServerTimeoutPlugin = (): Plugin => ({
	name: "e2e-server-timeout",
	apply: "serve",
	configureServer(server) {
		if (!isE2e || !server.httpServer) return;

		// Vite's Bun HTTP adapter defaults to a 10-second idle timeout. SSR can
		// exceed that while the isolated database and route graph are warming.
		server.httpServer.setTimeout(255_000);
		server.httpServer.requestTimeout = 255_000;
		server.httpServer.headersTimeout = 255_000;
		const bunServer = server.httpServer as typeof server.httpServer & {
			idleTimeout?: number;
		};
		bunServer.idleTimeout = 255;
	},
});

const nitroSsrCodeSplittingPlugin = (): Plugin => ({
	name: "nitro-ssr-code-splitting",
	configEnvironment(name) {
		if (name !== "nitro") return;
		return {
			build: {
				rolldownOptions: {
					output: {
						codeSplitting: false,
					},
				},
			},
		};
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
				hmr: {
					protocol: shouldUseMkcert ? "wss" : "ws",
					host: "127.0.0.1",
					port: isolatedDevConfig.hmrPort,
					clientPort: isolatedDevConfig.hmrPort,
					overlay: false,
				},
				fs: {
					allow: [workspaceRoot, path.dirname(routeTreePath)],
				},
				watch: {
					ignored: ["**/.cache/**", "**/.output/**"],
				},
			}
		: {
				hmr: {
					protocol: "wss",
					host: "localhost",
					port: 3001,
					clientPort: 3001,
				},
				watch: {
					ignored: ["**/.cache/**", "**/.output/**"],
				},
			},
	resolve: {
		alias: {
			"#route-tree": routeTreePath,

			"~": path.resolve(__dirname, "./src"),
		},
		dedupe: [
			"solid-js",
			"@solidjs/web",
			"@tanstack/query-core",
			"@tanstack/solid-query",
		],
		tsconfigPaths: true,
	},
	plugins: [
		...(shouldUseMkcert ? [mkcert()] : []),
		devApiMiddlewarePlugin(),
		e2eServerTimeoutPlugin(),
		e2eReadinessPlugin(),
		nitroSsrCodeSplittingPlugin(),
		...(shouldUseDevtools
			? [
					devtools({
						consolePiping: { enabled: false },
					}),
				]
			: []),
		nitro({
			...(e2eNitroOutput && { output: e2eNitroOutput }),
			publicAssets: [
				{
					baseURL: "/_scalar",
					dir: path.join(
						path.dirname(
							createRequire(import.meta.url).resolve("@scalar/api-reference"),
						),
						"browser",
					),
					ignore: ["**/chunks/**", "**/*.map", "**/*.esm.js"],
				},
			],
		}),
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
		// Workspace and dynamically split routes expose these after the initial scan.
		// Pre-bundle them so cold navigation does not invalidate in-flight shared chunks.
		include: [
			"@floating-ui/dom",
			"@internationalized/number",
			"@tanstack/form-core",
			"@tanstack/history",
			"@tanstack/query-core",
			"@tanstack/router-core",
			"@tanstack/router-core/isServer",
			"@tanstack/router-core/scroll-restoration-script",
			"@tanstack/router-core/ssr/client",
			"@tanstack/router-core/ssr/server",
			"isbot",
			"seroval",
		],
		exclude: ["@ui-sdk/core", "bun", "dghs-imgutils-rs"],
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
				"sharp",
			],
		},
	},
	ssr: {
		noExternal: [
			"@tanstack/solid-router",
			"@tanstack/solid-query",
			"@tanstack/solid-start",
			"@ui-sdk/solid",
			"@ui-sdk/core",
			"@lucide/solid",
			"@tanstack/charts",
		],
		external: [
			"bun",
			"@electric-sql/pglite",
			"ffmpeg-static",
			"ffmpeg-static-static",
			"fluent-ffmpeg",
			"archiver",
			"dghs-imgutils-rs",
			"sharp",
		],
	},
});

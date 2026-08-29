import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RPCHandler } from "@orpc/server/node";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
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
    throw new Error(`${name} must be an integer between 1 and 65535 when ${mode}`);
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
    routeTreePath: path.resolve(getRequiredEnvironment(`${prefix}_ROUTE_TREE_PATH`, mode)),
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
  !isE2e && (!isDevStartupMeasurement || process.env.DEV_STARTUP_DISABLE_MKCERT !== "1");
const shouldUseDevtools =
  !isDevStartupMeasurement || process.env.DEV_STARTUP_DISABLE_DEVTOOLS !== "1";

type RuntimeImport = <TModule>(specifier: string) => Promise<TModule>;

// Keep these imports out of Vite config bundling; the server modules rely on Bun's runtime TS path resolution.
const runtimeImport = new Function("specifier", "return import(specifier)") as RuntimeImport;

function serverModuleUrl(relativePath: string): string {
  return pathToFileURL(path.resolve(__dirname, relativePath)).href;
}

function resolveSafeMediaPath(basePath: string, targetPath: string): string {
  const resolvedPath = path.resolve(basePath, targetPath);
  const absoluteBase = path.resolve(basePath);
  if (
    resolvedPath !== absoluteBase &&
    !resolvedPath.startsWith(`${absoluteBase}${path.sep}`)
  ) {
    throw new Error(`Invalid path: ${targetPath}`);
  }
  return resolvedPath;
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
  const [{ appRouter }, { initServices, startBackgroundWorker }, { logger }, { createRpcResponseHeaders }] = await Promise.all([
    runtimeImport<typeof import("./src/infrastructure/api/app-router")>(
      serverModuleUrl("src/infrastructure/api/app-router.ts"),
    ),
    runtimeImport<typeof import("./src/infrastructure/bootstrap")>(
      serverModuleUrl("src/infrastructure/bootstrap.ts"),
    ),
    runtimeImport<typeof import("./src/infrastructure/logger")>(
      serverModuleUrl("src/infrastructure/logger.ts"),
    ),
    runtimeImport<typeof import("./src/infrastructure/api/rpc-response-headers")>(
      serverModuleUrl("src/infrastructure/api/rpc-response-headers.ts"),
    ),
  ]);

  return {
    handler: new RPCHandler(appRouter, {
      plugins: [new ResponseHeadersPlugin()],
    }),
    createRpcResponseHeaders,
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

const loadDevMediaFileHandler = async () => {
  const [
    { services },
    { initServices },
    { getContentTypeFromExtension },
    { localConnectionSchema },
  ] = await Promise.all([
    runtimeImport<typeof import("./src/infrastructure/service-registry")>(
      serverModuleUrl("src/infrastructure/service-registry.ts"),
    ),
    runtimeImport<typeof import("./src/infrastructure/bootstrap")>(
      serverModuleUrl("src/infrastructure/bootstrap.ts"),
    ),
    runtimeImport<
      typeof import("../../packages/core/src/domain/media/utils/media-type-utils")
    >(
      serverModuleUrl(
        "../../packages/core/src/domain/media/utils/media-type-utils.ts",
      ),
    ),
    runtimeImport<
      typeof import("../../packages/core/src/domain/sources/schemas")
    >(
      serverModuleUrl("../../packages/core/src/domain/sources/schemas.ts"),
    ),
  ]);

  return async (mediaSourceId: string, mediaId: string): Promise<Response> => {
    initServices();
    const media = await services.getMediaRepository().findById(mediaId);
    if (!media || media.mediaSourceId !== mediaSourceId) {
      return new Response("Media not found", { status: 404 });
    }

    const mediaSource = await services
      .getSourceRepository()
      .findById(mediaSourceId);
    if (mediaSource?.type !== "local") {
      return new Response("Invalid media source", { status: 400 });
    }

    const connectionInfo = localConnectionSchema.parse(mediaSource.connectionInfo);
    const fullPath = resolveSafeMediaPath(connectionInfo.path, media.filePath);
    const file = Bun.file(fullPath);
    if (!(await file.exists())) {
      return new Response("File not found on disk", { status: 404 });
    }

    return new Response(file, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": getContentTypeFromExtension(media.fileName),
      },
    });
  };
};

let devMediaFileHandlerPromise: ReturnType<typeof loadDevMediaFileHandler> | undefined;

function getDevMediaFileHandler(): ReturnType<typeof loadDevMediaFileHandler> {
  devMediaFileHandlerPromise ??= loadDevMediaFileHandler();
  return devMediaFileHandlerPromise;
}

const devMediaFileMiddlewarePlugin = (): Plugin => ({
  name: "dev-media-file-middleware",
  apply: "serve",
  configureServer(server) {
    if (!isE2e) return;
    server.middlewares.use(async (req, res, next) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      const match =
        /^\/api\/sources\/([^/]+)\/([^/]+)$/.exec(pathname);
      if (!match) {
        next();
        return;
      }

      try {
        const response = await (
          await getDevMediaFileHandler()
        )(match[1], match[2]);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        res.statusCode = 500;
        res.end(error instanceof Error ? error.message : "Media request failed");
      }
    });
  },
});

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
          logger?.info("Dev startup measurement: matched RPC response finished");
        }
        startBackgroundWorker();
      } catch (error) {
        backgroundWorkerStarted = false;
        logger?.error({ err: error }, "Failed to start background worker after dev RPC response");
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
        const { handler, initServices, createRpcResponseHeaders } = devRpcHandler;
        startBackgroundWorker = devRpcHandler.startBackgroundWorker;
        initServices();

        let matched = false;
        let responseFinished = false;
        const startAfterSuccessfulResponse = () => {
          responseFinished = true;
          if (matched && res.statusCode >= 200 && res.statusCode < 300) {
            startBackgroundWorkerOnce();
          }
        };
        res.once("finish", startAfterSuccessfulResponse);

        const result = await handler.handle(req, res, {
          prefix: "/api/rpc",
          context: { resHeaders: createRpcResponseHeaders(req.url ?? "/") },
        });
        matched = result.matched;
        if (matched && responseFinished && res.statusCode >= 200 && res.statusCode < 300) {
          startBackgroundWorkerOnce();
        }

        if (!matched) {
          logger.warn({ method: req.method, url: req.url }, "Unmatched RPC request");
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

const e2eReadinessPlugin = (): Plugin => ({
	name: "e2e-readiness",
	apply: "serve",
	configureServer(server) {
		if (!isE2e) return;
	server.middlewares.use("/__e2e_ready", async (_req, res) => {
			try {
				const devRpcHandler = await getDevRpcHandler();
				devRpcHandler.initServices();
				devRpcHandler.startBackgroundWorker();

				const probeUrl = `http://127.0.0.1:${isolatedDevConfig?.port}/api/rpc/sources/list`;
				let lastProbeFailure = "SSR readiness probe did not return a successful response";
				for (let attempt = 0; attempt < 120; attempt += 1) {
					const controller = new AbortController();
					const timeout = setTimeout(() => controller.abort(), 5_000);
					try {
						const probeResponse = await fetch(probeUrl, {
							body: "{}",
							headers: { "content-type": "application/json" },
							method: "POST",
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
						lastProbeFailure = error instanceof Error ? error.message : String(error);
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
				res.end(error instanceof Error ? error.message : "E2E server is not ready");
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
    devMediaFileMiddlewarePlugin(),
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
		exclude: ["dghs-imgutils-rs"],
  },
  customLogger: {
    warn(msg, options) {
      if (typeof msg === "string" && msg.includes("externalized for browser compatibility")) {
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
      "@kobalte/core",
      "solid-sonner",
      "corvu",
      "@solid-primitives/.*",
    ],
    external: [
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

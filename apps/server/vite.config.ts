import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RPCHandler } from "@orpc/server/node";
import { defineConfig } from "vite-plus";
import type { Plugin } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import solidPlugin from "vite-plugin-solid";
import { nitro } from "nitro/vite";
import { devtools } from "@tanstack/devtools-vite";
import mkcert from "vite-plugin-mkcert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const devOrpcNodeMiddlewarePlugin = (): Plugin => ({
	name: "dev-orpc-node-middleware",
	apply: "serve",
	async configureServer(server) {
		const [{ appRouter }, { bootstrap }, { logger }] = await Promise.all([
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
		const handler = new RPCHandler(appRouter);

		server.middlewares.use(async (req, res, next) => {
			const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
			if (pathname !== "/api/rpc" && !pathname.startsWith("/api/rpc/")) {
				next();
				return;
			}

			try {
				bootstrap();
				const { matched } = await handler.handle(req, res, {
					prefix: "/api/rpc",
					context: {},
				});

				if (!matched) {
					logger.warn(
						{ method: req.method, url: req.url },
						"Unmatched RPC request",
					);
					res.statusCode = 404;
					res.end("Not Found");
					return;
				}
			} catch (error) {
				logger.error({ err: error }, "Dev RPC middleware failed");
				next(error);
			}
		});
	},
});

export default defineConfig({
	server: {
		hmr: {
			protocol: "wss",
			host: "localhost",
			port: 3001,
			clientPort: 3001,
		},
	},
	resolve: {
		alias: {
			"@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
			"@": path.resolve(__dirname, "../../packages/core/src"),
			"~": path.resolve(__dirname, "./src"),
		},
		tsconfigPaths: true,
	},
	plugins: [
		mkcert(),
		bypassSecFetchDestPlugin(),
		devOrpcNodeMiddlewarePlugin(),
		devtools({
			consolePiping: { enabled: false },
		}),
		nitro(),
		tanstackRouter({
			target: "solid",
			autoCodeSplitting: true,
			routeFileIgnorePattern: ".*/components/.*",
		}),
		tailwindcss(),
		tanstackStart(),
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

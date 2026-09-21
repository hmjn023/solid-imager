import { mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig, type Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(fixtureDirectory, "../../../../");
const workspaceRoot = path.resolve(serverRoot, "../..");
const tauriRoot = path.join(workspaceRoot, "apps/tauri");

function requiredPort(name: string): number {
	const value = process.env[name];
	const port = Number(value);
	if (!value || !Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error(`${name} must be an integer between 1 and 65535`);
	}
	return port;
}

function requiredPath(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} must be set for the Tauri E2E fixture`);
	}
	return path.resolve(value);
}

const runtimeDirectory = requiredPath("E2E_RUNTIME_DIR");
const tauriPort = requiredPort("E2E_TAURI_PORT");
const tauriHmrPort = requiredPort("E2E_TAURI_HMR_PORT");
const serverPort = requiredPort("E2E_PORT");
// The isolated server runtime is deliberately kept below /tmp, while the
// checkout lives on a different filesystem in some CI/dev environments. The
// router plugin materializes its generated tree with rename(2), which fails
// across filesystems. Keep a unique generated tree in the ignored server
// temp directory (keyed by this run's runtime directory) and import that file
// directly from the fixture.
const routeTreePath = path.join(
	serverRoot,
	".tanstack",
	"tmp",
	`${path.basename(runtimeDirectory)}-tauri-route-tree.gen.ts`,
);
mkdirSync(path.dirname(routeTreePath), { recursive: true });
const outputDirectory = path.join(runtimeDirectory, "tauri-dist");
const apiTarget = `http://127.0.0.1:${serverPort}`;
const fixtureOrigin = `http://127.0.0.1:${tauriPort}`;
const routerModulePath = path.join(tauriRoot, "src/router.tsx");
const adapterDirectory = path.join(fixtureDirectory, "adapters");

function rewriteRouteTreeImport(): Plugin {
	return {
		name: "solid-imager-e2e-tauri-route-tree-import",
		enforce: "post",
		transform(code, id) {
			const sourceId = id.split("?", 1)[0];
			if (path.resolve(sourceId) !== routerModulePath) {
				return null;
			}
			const rewritten = code.replace(
				/from\s+["']\.\/routeTree\.gen["']/,
				`from ${JSON.stringify(routeTreePath)}`,
			);
			return rewritten === code ? null : { code: rewritten, map: null };
		},
	};
}

function handleBinaryMediaRequest(
	req: IncomingMessage,
	res: ServerResponse,
	next: (error?: unknown) => void,
): void {
	if (req.method !== "GET" || !req.url) {
		next();
		return;
	}

	const requestUrl = new URL(req.url, fixtureOrigin);
	if (
		!/^\/api\/sources\/[^/]+\/(?:thumbnail\/)?[^/]+$/.test(requestUrl.pathname)
	) {
		next();
		return;
	}

	void (async () => {
		try {
			const requestHeaders: Record<string, string> = {};
			for (const name of ["accept", "range"]) {
				const value = req.headers[name];
				if (typeof value === "string") requestHeaders[name] = value;
			}
			const response = await fetch(
				new URL(requestUrl.pathname + requestUrl.search, apiTarget),
				{ headers: requestHeaders },
			);
			res.statusCode = response.status;
			response.headers.forEach((value, name) => {
				res.setHeader(name, value);
			});
			res.end(Buffer.from(await response.arrayBuffer()));
		} catch (error) {
			next(error);
		}
	})();
}

function binaryMediaProxy(): Plugin {
	return {
		name: "solid-imager-e2e-binary-media-proxy",
		configureServer(server) {
			server.middlewares.use(handleBinaryMediaRequest);
		},
		configurePreviewServer(server) {
			server.middlewares.use(handleBinaryMediaRequest);
		},
	};
}

const proxy = {
	"/api": {
		target: apiTarget,
		changeOrigin: true,
	},
};

export default defineConfig({
	root: tauriRoot,
	base: "./",
	resolve: {
		alias: {
			"@solid-imager/core": path.join(workspaceRoot, "packages/core/src"),
			"@solid-imager/client": path.join(workspaceRoot, "packages/client/src"),
			"@solid-imager/ui": path.join(workspaceRoot, "packages/ui/src"),
			"@": path.join(workspaceRoot, "packages/core/src"),
			"~": path.join(tauriRoot, "src"),
			"@tauri-apps/plugin-http": path.join(adapterDirectory, "http.ts"),
			"@tauri-apps/plugin-sql": path.join(adapterDirectory, "sql.ts"),
			"@tauri-apps/plugin-store": path.join(adapterDirectory, "store.ts"),
			"@tanstack/tauri-db-sqlite-persistence": path.join(
				adapterDirectory,
				"persistence.ts",
			),
		},
		dedupe: [
			"@tanstack/query-core",
			"@tanstack/solid-query",
			"@tanstack/solid-router",
			"solid-js",
			"solid-js/web",
			"zod",
		],
	},
	server: {
		host: "127.0.0.1",
		port: tauriPort,
		strictPort: true,
		hmr: {
			host: "127.0.0.1",
			port: tauriHmrPort,
			clientPort: tauriHmrPort,
			protocol: "ws",
		},
		proxy,
		fs: {
			allow: [workspaceRoot, runtimeDirectory],
		},
	},
	preview: {
		host: "127.0.0.1",
		port: tauriPort,
		strictPort: true,
		proxy,
	},
	build: {
		outDir: outputDirectory,
		emptyOutDir: true,
	},
	define: {
		// The Tauri app treats this as its initial server profile. Keeping it on
		// the fixture origin makes both dev and production use the same-origin
		// proxy and prevents the built-in LAN fallback from being exercised.
		"import.meta.env.VITE_API_URL": JSON.stringify(fixtureOrigin),
	},
	plugins: [
		binaryMediaProxy(),
		tanstackRouter({
			target: "solid",
			routesDirectory: path.join(tauriRoot, "src/routes"),
			generatedRouteTree: routeTreePath,
			autoCodeSplitting: true,
		}),
		rewriteRouteTreeImport(),
		solidPlugin(),
		tailwindcss(),
	],
});

import { lstat, mkdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { mediaGenerationInfo, medias, mediaSources } from "@solid-imager/db/schema";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import sharp from "sharp";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
	getE2eMediaDir,
	getE2eRuntimeDir,
	getFixtureMediaPath,
} from "../src/tests/e2e/support/fixture";

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

function assertSafeRuntimeDir(runtimeDir: string): void {
	const resolvedRoot = path.resolve(allowedRuntimeRoot);
	const relative = path.relative(resolvedRoot, runtimeDir);
	if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(
			`E2E_RUNTIME_DIR must be a child of ${resolvedRoot}, received ${runtimeDir}`,
		);
	}
}

function createImageSvg(accentColor: string, backgroundColor: string): Buffer {
	return Buffer.from(`
		<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
			<rect width="256" height="256" fill="${backgroundColor}" />
			<circle cx="128" cy="128" r="84" fill="${accentColor}" />
			<path d="M48 184 L104 120 L144 160 L184 96 L224 184 Z" fill="#ffffff" fill-opacity="0.85" />
		</svg>
	`);
}

async function seedMediaFixtures(runtimeDir: string): Promise<void> {
	const mediaDir = getE2eMediaDir();
	const thumbnailDir = path.join(runtimeDir, "thumbnails", E2E_SOURCE_ID);
	await mkdir(mediaDir, { recursive: true });
	await mkdir(thumbnailDir, { recursive: true });

	const primaryPath = getFixtureMediaPath(E2E_PRIMARY_FILE_NAME);
	const similarPath = getFixtureMediaPath(E2E_SIMILAR_FILE_NAME);
	await Promise.all([
		sharp(createImageSvg("#4f46e5", "#e0e7ff")).png().toFile(primaryPath),
		sharp(createImageSvg("#6366f1", "#eef2ff")).png().toFile(similarPath),
	]);

	await Promise.all([
		sharp(primaryPath)
			.resize({ width: 512, height: 512, fit: "inside" })
			.webp()
			.toFile(path.join(thumbnailDir, `${E2E_PRIMARY_MEDIA_ID}.webp`)),
		sharp(similarPath)
			.resize({ width: 512, height: 512, fit: "inside" })
			.webp()
			.toFile(path.join(thumbnailDir, `${E2E_SIMILAR_MEDIA_ID}.webp`)),
	]);

	const [primaryStats, similarStats] = await Promise.all([
		stat(primaryPath),
		stat(similarPath),
	]);
	const pgliteDir = path.join(runtimeDir, "pglite");
	const client = new PGlite(pgliteDir);
	const db = drizzle(client);

	try {
		await migrate(db, { migrationsFolder: path.join(appRoot, "drizzle") });
		const seededAt = new Date();
		await db.insert(mediaSources).values({
			id: E2E_SOURCE_ID,
			name: E2E_SOURCE_NAME,
			description: "Isolated media source for browser E2E tests",
			type: "local",
			connectionInfo: { path: mediaDir },
			createdAt: seededAt,
			updatedAt: seededAt,
		});
		await db.insert(medias).values([
			{
				id: E2E_PRIMARY_MEDIA_ID,
				mediaSourceId: E2E_SOURCE_ID,
				filePath: E2E_PRIMARY_FILE_NAME,
				fileName: E2E_PRIMARY_FILE_NAME,
				mediaType: "image",
				width: 256,
				height: 256,
				fileSize: primaryStats.size,
				description: "Primary E2E fixture media",
				createdAt: primaryStats.birthtime,
				modifiedAt: primaryStats.mtime,
				indexedAt: seededAt,
				status: "active",
			},
			{
				id: E2E_SIMILAR_MEDIA_ID,
				mediaSourceId: E2E_SOURCE_ID,
				filePath: E2E_SIMILAR_FILE_NAME,
				fileName: E2E_SIMILAR_FILE_NAME,
				mediaType: "image",
				width: 256,
				height: 256,
				fileSize: similarStats.size,
				description: "Similarity candidate E2E fixture media",
				createdAt: similarStats.birthtime,
				modifiedAt: similarStats.mtime,
				indexedAt: seededAt,
				status: "active",
			},
		]);
		await db.insert(mediaGenerationInfo).values([
			{
				mediaId: E2E_PRIMARY_MEDIA_ID,
				metadata: { fixture: "e2e-primary" },
			},
			{
				mediaId: E2E_SIMILAR_MEDIA_ID,
				metadata: { fixture: "e2e-similar" },
			},
		]);
	} finally {
		await client.close();
	}
}

async function createRouteTreePlaceholder(runtimeDir: string): Promise<string> {
	const frozenRouteTreePath = path.join(runtimeDir, "routeTree.e2e.ts");

	// The Vite router plugin must replace this before application modules are
	// transformed. A placeholder makes generation failures fail this isolated
	// run instead of silently falling back to a checked-in route tree.
	await writeFile(
		frozenRouteTreePath,
		"export const __e2eRouteTreePlaceholder = true;\n",
	);
	return frozenRouteTreePath;
}

async function prepareE2eEnvironment(runtimeDir: string): Promise<string> {
	await rm(runtimeDir, { recursive: true, force: true });
	await mkdir(runtimeDir, { recursive: true });

	const config = {
		...defaultAppConfig,
		jobs: {
			...defaultAppConfig.jobs,
			concurrency: 1,
			aiConcurrency: 1,
			pollIntervalMs: 100,
			enableAutoTagging: false,
			enableAutoCcipExtraction: false,
		},
		storage: {
			...defaultAppConfig.storage,
			thumbnailDir: path.join(runtimeDir, "thumbnails"),
		},
		lancedb: {
			...defaultAppConfig.lancedb,
			autoFullSync: false,
			cacheDir: path.join(runtimeDir, "lancedb-cache"),
			ccipVectorDir: path.join(runtimeDir, "lancedb-ccip"),
		},
	};
	await writeFile(
		path.join(runtimeDir, "config.json"),
		JSON.stringify(config, null, 2),
	);
	await seedMediaFixtures(runtimeDir);
	return await createRouteTreePlaceholder(runtimeDir);
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
assertSafeRuntimeDir(runtimeDir);
const routeTreePath = await prepareE2eEnvironment(runtimeDir);
await startServer(mode, serverEnvironment(runtimeDir, routeTreePath));

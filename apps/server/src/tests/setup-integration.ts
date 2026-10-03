import path from "node:path";
import { config } from "dotenv";
import { beforeAll, beforeEach, vi } from "vitest";

function createBunImageMock(input: string) {
	const operations: Array<(pipeline: any) => any> = [];
	const image = {
		resize(width: number, height?: number, options?: unknown) {
			operations.push((pipeline) => pipeline.resize(width, height, options));
			return image;
		},
		webp(options?: unknown) {
			operations.push((pipeline) => pipeline.webp(options));
			return image;
		},
		async metadata() {
			const { default: sharp } = await import("sharp");
			let pipeline = sharp(input, { failOn: "none" });
			for (const operation of operations) {
				pipeline = operation(pipeline);
			}
			return pipeline.metadata();
		},
		async bytes() {
			const { default: sharp } = await import("sharp");
			let pipeline = sharp(input, { failOn: "none" });
			for (const operation of operations) {
				pipeline = operation(pipeline);
			}
			const buffer = await pipeline.toBuffer();
			return new Uint8Array(buffer);
		},
		async write(destination: string) {
			const { default: sharp } = await import("sharp");
			let pipeline = sharp(input, { failOn: "none" });
			for (const operation of operations) {
				pipeline = operation(pipeline);
			}
			const result = await pipeline.toFile(destination);
			return result.size;
		},
	};
	return image;
}

if (typeof (globalThis as any).Bun === "undefined") {
	(globalThis as any).Bun = {
		file: (path: string) => {
			return {
				image: () => createBunImageMock(path),
				exists: async () => {
					const fs = await import("node:fs/promises");
					try {
						await fs.access(path);
						return true;
					} catch {
						return false;
					}
				},
				arrayBuffer: async () => {
					const fs = await import("node:fs/promises");
					try {
						return (await fs.readFile(path)).buffer;
					} catch {
						return new ArrayBuffer(0);
					}
				},
				text: async () => {
					const fs = await import("node:fs/promises");
					try {
						return await fs.readFile(path, "utf-8");
					} catch {
						return "";
					}
				},
				bytes: async () => {
					const fs = await import("node:fs/promises");
					try {
						return new Uint8Array(await fs.readFile(path));
					} catch {
						return new Uint8Array(0);
					}
				},
				size: 0,
				type: "text/plain",
				delete: async () => {
					const fs = await import("node:fs/promises");
					try {
						await fs.unlink(path);
					} catch {}
				},
			};
		},
		write: async (dest: any, data: any) => {
			const fs = await import("node:fs/promises");
			const destPath =
				typeof dest === "string" ? dest : dest.name || String(dest);

			let bytesLength = 0;
			if (data && typeof data.arrayBuffer === "function") {
				const buf = await data.arrayBuffer();
				await fs.writeFile(destPath, Buffer.from(buf));
				bytesLength = buf.byteLength;
			} else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
				const buf = Buffer.from(data as any);
				await fs.writeFile(destPath, buf);
				bytesLength = buf.byteLength;
			} else if (typeof data === "string") {
				await fs.writeFile(destPath, data);
				bytesLength = Buffer.from(data).byteLength;
			}
			return bytesLength;
		},
		Archive: class {
			private map: any;
			private options: any;
			constructor(input: any, options: any) {
				this.map = input;
				this.options = options;
			}
			async bytes() {
				return new Uint8Array();
			}
			async blob() {
				return new Blob([]);
			}
			async extract(_dest: string) {
				return 0;
			}
		},
	};
}

// Mock the "bun" module so "import { Glob, SQL } from 'bun'" works on Node.js
vi.mock("bun", () => {
	return {
		SQL: class {
			async connect() {
				return this;
			}
			async unsafe() {
				return [];
			}
			async close() {}
			async end() {}
		},
		Glob: class {
			private pattern: string;
			constructor(pattern: string) {
				this.pattern = pattern;
			}
			async *scan(options: any) {
				const fs = await import("node:fs/promises");
				const path = await import("node:path");
				const root = options.cwd || process.cwd();

				async function* walk(dir: string): AsyncGenerator<string> {
					try {
						const entries = await fs.readdir(dir, { withFileTypes: true });
						for (const entry of entries) {
							const res = path.resolve(dir, entry.name);
							if (entry.name.startsWith(".")) {
								continue;
							}
							if (entry.isDirectory()) {
								yield* walk(res);
							} else {
								yield path.relative(root, res);
							}
						}
					} catch (_e) {
						// Ignored
					}
				}
				yield* walk(root);
			}
		},
	};
});

// Generic integration fixtures use placeholder source paths such as "/".
// Do not let automatic startup monitoring scan those paths during unrelated tests;
// recovery tests explicitly exercise monitoring with their own temporary directories.
vi.mock(
	"~/infrastructure/jobs/file-watcher-service",
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import("~/infrastructure/jobs/file-watcher-service")
			>();
		return {
			...actual,
			FileWatcherService: {
				...actual.FileWatcherService,
				startMonitoringAll: vi.fn().mockResolvedValue(undefined),
			},
		};
	},
);

// Bootstrap
beforeAll(async () => {
	// 1. Ensure DB migration is completed first
	await mockDbFactory();

	// 2. Then bootstrap the application
	const { startBackgroundWorker } = await import("~/infrastructure/bootstrap");
	startBackgroundWorker();
});

config({ path: path.resolve(process.cwd(), ".env") });

process.env.DB_HOST = "pglite";
if (process.env.NODE_ENV !== "production") {
	process.env.NODE_ENV = "test";
}

const { mockDbFactory } = vi.hoisted(() => {
	let dbInstance: { db: unknown } | null = null;
	return {
		mockDbFactory: async () => {
			if (dbInstance) {
				return dbInstance;
			}

			const { createPglite } = await import("~/infrastructure/db/pglite");
			const { drizzle } = await import("drizzle-orm/pglite");
			const { migrate } = await import("drizzle-orm/pglite/migrator");
			const schema = await import("~/infrastructure/db/schema");
			const nodePath = await import("node:path");

			const client = createPglite();
			const testDb = drizzle(client, { schema });
			const migrationsFolder = process.cwd().endsWith("apps/server")
				? nodePath.resolve(process.cwd(), "drizzle")
				: nodePath.resolve(process.cwd(), "apps/server/drizzle");
			await migrate(testDb, { migrationsFolder });

			dbInstance = { db: testDb };
			return dbInstance;
		},
	};
});

vi.mock("~/infrastructure/db", mockDbFactory);
vi.mock("~/infrastructure/db/index", mockDbFactory);

beforeEach(() => {
	vi.clearAllMocks();
});

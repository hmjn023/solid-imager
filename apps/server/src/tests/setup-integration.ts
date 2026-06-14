import path from "node:path";
import { config } from "dotenv";
import { beforeAll, beforeEach, vi } from "vite-plus/test";

if (typeof (globalThis as any).Bun === "undefined") {
	(globalThis as any).Bun = {
		file: (path: string) => {
			return {
				exists: () =>
					import("node:fs/promises").then((fs) => {
						const res = fs.access?.(path);
						return res
							? res.then(() => true).catch(() => false)
							: Promise.resolve(false);
					}),
				arrayBuffer: () =>
					import("node:fs/promises").then((fs) => {
						const res = fs.readFile?.(path);
						return res
							? res
									.then((buf) => (buf ? buf.buffer : new ArrayBuffer(0)))
									.catch(() => new ArrayBuffer(0))
							: Promise.resolve(new ArrayBuffer(0));
					}),
				text: () =>
					import("node:fs/promises").then((fs) => {
						const res = fs.readFile?.(path, "utf-8");
						return res
							? res.then((val) => val || "").catch(() => "")
							: Promise.resolve("");
					}),
				bytes: () =>
					import("node:fs/promises").then((fs) => {
						const res = fs.readFile?.(path);
						return res
							? res
									.then((buf) =>
										buf ? new Uint8Array(buf) : new Uint8Array(0),
									)
									.catch(() => new Uint8Array(0))
							: Promise.resolve(new Uint8Array(0));
					}),
				size: 0,
				type: "text/plain",
				delete: () =>
					import("node:fs/promises").then((fs) => {
						const res = fs.unlink?.(path);
						return res ? res.then(() => {}).catch(() => {}) : Promise.resolve();
					}),
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
		SQL: class {},
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

// Bootstrap
beforeAll(async () => {
	// 1. Ensure DB migration is completed first
	await mockDbFactory();

	// 2. Then bootstrap the application
	const { bootstrap } = await import("~/infrastructure/bootstrap");
	bootstrap();
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

			const { PGlite } = await import("@electric-sql/pglite");
			const { drizzle } = await import("drizzle-orm/pglite");
			const { migrate } = await import("drizzle-orm/pglite/migrator");
			const schema = await import("~/infrastructure/db/schema");
			const nodePath = await import("node:path");

			const client = new PGlite();
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

import path from "node:path";
import { config } from "dotenv";
import { beforeEach, vi } from "vite-plus/test";

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

// Load env vars
config({ path: path.resolve(process.cwd(), ".env") });

if (process.env.NODE_ENV !== "production") {
	process.env.NODE_ENV = "test";
}

// Mock DB with valid UUIDs
const { mockDb } = vi.hoisted(() => ({
	mockDb: {
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				onConflictDoUpdate: vi.fn(() => ({
					returning: vi.fn(() => [
						{
							id: "11111111-1111-4111-8111-111111111111",
							mediaSourceId: "22222222-2222-4222-8222-222222222222",
							filePath: "/mock/path/image.png",
							fileName: "image.png",
							mediaType: "image",
							width: 800,
							height: 600,
							fileSize: 1024,
							createdAt: new Date(),
							modifiedAt: new Date(),
							indexedAt: new Date(),
						},
					]),
				})),
				returning: vi.fn(() => [
					{
						id: "11111111-1111-4111-8111-111111111111",
						mediaSourceId: "22222222-2222-4222-8222-222222222222",
						filePath: "/mock/path/image.png",
						fileName: "image.png",
						mediaType: "image",
						width: 800,
						height: 600,
						fileSize: 1024,
						createdAt: new Date(),
						modifiedAt: new Date(),
						indexedAt: new Date(),
					},
				]),
			})),
		})),
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => [
					{
						id: "33333333-3333-4333-8333-333333333333",
						mediaSourceId: "22222222-2222-4222-8222-222222222222",
						filePath: "/mock/path/image.png",
						fileName: "image.png",
						mediaType: "image",
						width: 800,
						height: 600,
						fileSize: 1024,
						createdAt: new Date(),
						modifiedAt: new Date(),
						indexedAt: new Date(),
					},
				]),
			})),
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(() => [
						{
							id: "33333333-3333-4333-8333-333333333333",
							mediaSourceId: "22222222-2222-4222-8222-222222222222",
							filePath: "/mock/path/image.png",
							fileName: "updated_image.png",
							mediaType: "image",
							width: 1024,
							height: 768,
							fileSize: 1024,
							createdAt: new Date(),
							modifiedAt: new Date(),
							indexedAt: new Date(),
						},
					]),
				})),
			})),
		})),
		delete: vi.fn(() => ({
			where: vi.fn(() => ({
				returning: vi.fn(() => [
					{
						id: "33333333-3333-4333-8333-333333333333",
						mediaSourceId: "22222222-2222-4222-8222-222222222222",
						filePath: "/mock/path/image.png",
						fileName: "image.png",
						mediaType: "image",
						width: 800,
						height: 600,
						fileSize: 1024,
						createdAt: new Date(),
						modifiedAt: new Date(),
						indexedAt: new Date(),
					},
				]),
			})),
		})),
		query: {
			mediaSources: {
				findFirst: vi.fn(() => Promise.resolve(null)),
			},
		},
		transaction: vi.fn((fn) => fn(null)),
	},
}));

// Fix transaction to use mockDb
mockDb.transaction = vi.fn((fn) => fn(mockDb));

// Mock the DB module for unit tests
vi.mock("~/infrastructure/db/index", () => ({
	db: mockDb,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

import type { MediaSource } from "@solid-imager/core/domain/repositories/source-repository";
import { describe, expect, it, vi } from "vite-plus/test";
import {
	createSourceSyncRuntime,
	parseSourceWatchEventPayload,
	type SourceSyncMediaRecord,
	type SourceSyncRuntimeDeps,
	type SourceSyncUpsertInput,
} from "../services/source-sync-runtime";

const source: MediaSource = {
	id: "source-1",
	name: "Local",
	description: null,
	type: "local",
	connectionInfo: { path: "/library" },
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
};

type TestRuntimeOptions = {
	files?: Set<string>;
	directories?: Map<string, string[]>;
	existing?: SourceSyncMediaRecord[];
};

function createTestRuntime(options: TestRuntimeOptions = {}) {
	const files = options.files ?? new Set<string>();
	const directories =
		options.directories ?? new Map<string, string[]>([["/library", []]]);
	const records = new Map<string, SourceSyncMediaRecord>();
	for (const record of options.existing ?? []) {
		records.set(record.filePath, record);
	}

	let nextId = 1;
	const upsertInputs: SourceSyncUpsertInput[] = [];
	const deletedIds: string[] = [];
	const deletedPrefixes: string[] = [];
	const addedEvents: unknown[] = [];
	const changedEvents: unknown[] = [];
	const deletedEvents: unknown[] = [];
	const enqueuedJobs: Array<{
		sourceId: string;
		mediaId: string;
		sourcePath: string;
	}> = [];

	const deps: SourceSyncRuntimeDeps = {
		resolveSourceRootPath: () => "/library",
		toRelativePath: (rootPath, fullPath) =>
			fullPath === rootPath
				? ""
				: fullPath.replace(`${rootPath}/`, "").replace(/[\\/]+/g, "/"),
		joinPath: (rootPath, relativePath) =>
			`${rootPath.replace(/[\\/]+$/, "")}/${relativePath.replace(/^[\\/]+/, "")}`,
		basename: (path) => path.split(/[\\/]/).at(-1) ?? path,
		fileSystem: {
			exists: vi.fn(async (path) => files.has(path) || directories.has(path)),
			stat: vi.fn(async (path) => ({ isDirectory: directories.has(path) })),
			readdir: vi.fn(async (path) => directories.get(path) ?? []),
		},
		config: {
			getSupportedExtensions: () => ({
				image: [".png", ".jpg"],
				video: [".mp4"],
				audio: [".mp3"],
			}),
			getProbeConcurrency: () => 2,
		},
		probeMedia: vi.fn(async () => ({
			width: 640,
			height: 480,
			size: 1234,
			createdAt: "2026-01-01T00:00:00Z",
			modifiedAt: "2026-01-02T00:00:00Z",
		})),
		mediaRepository: {
			findByPath: vi.fn(async (_sourceId, relativePath) => {
				return records.get(relativePath) ?? null;
			}),
			findAllPathsBySourceId: vi.fn(async () => Array.from(records.values())),
			batchUpsert: vi.fn(async (inputs: SourceSyncUpsertInput[]) => {
				upsertInputs.push(...inputs);
				return inputs.map((input) => {
					const existing = records.get(input.filePath);
					if (existing) {
						return existing;
					}
					const record = { id: `media-${nextId++}`, filePath: input.filePath };
					records.set(input.filePath, record);
					return record;
				});
			}),
			delete: vi.fn(async (mediaId) => {
				deletedIds.push(mediaId);
				for (const [path, record] of records.entries()) {
					if (record.id === mediaId) {
						records.delete(path);
					}
				}
			}),
			deleteByPathPrefix: vi.fn(async (_sourceId, relativePath) => {
				deletedPrefixes.push(relativePath);
				const deleted: SourceSyncMediaRecord[] = [];
				for (const [path, record] of Array.from(records.entries())) {
					if (path === relativePath || path.startsWith(`${relativePath}/`)) {
						deleted.push(record);
						records.delete(path);
					}
				}
				return deleted;
			}),
		},
		enqueueProcessMediaJobs: vi.fn(async (jobs) => {
			enqueuedJobs.push(...jobs);
		}),
		events: {
			mediaAdded: vi.fn((event) => {
				addedEvents.push(event);
			}),
			mediaChanged: vi.fn((event) => {
				changedEvents.push(event);
			}),
			mediaDeleted: vi.fn((event) => {
				deletedEvents.push(event);
			}),
		},
		retry: {
			sleep: vi.fn(async () => undefined),
		},
	};

	return {
		runtime: createSourceSyncRuntime(deps),
		deps,
		upsertInputs,
		deletedIds,
		deletedPrefixes,
		addedEvents,
		changedEvents,
		deletedEvents,
		enqueuedJobs,
	};
}

describe("source-sync-runtime", () => {
	it("ignores hidden paths and unsupported extensions", async () => {
		const { runtime, deps, upsertInputs } = createTestRuntime({
			files: new Set([
				"/library/.hidden.png",
				"/library/note.txt",
				"/library/.cache/inside.png",
			]),
			directories: new Map([
				["/library", [".hidden.png", "note.txt", ".cache"]],
				["/library/.cache", ["inside.png"]],
			]),
		});

		const result = await runtime.syncLocalSource(source);

		expect(result).toEqual({
			id: "source-1",
			success: true,
			added: 0,
			deleted: 0,
		});
		expect(upsertInputs).toEqual([]);
		expect(deps.probeMedia).not.toHaveBeenCalled();
	});

	it("upserts new files, publishes media-added, and enqueues process jobs", async () => {
		const { runtime, upsertInputs, addedEvents, enqueuedJobs } =
			createTestRuntime({
				files: new Set(["/library/image.png"]),
				directories: new Map([["/library", ["image.png"]]]),
			});

		const result = await runtime.syncLocalSource(source);

		expect(result.added).toBe(1);
		expect(upsertInputs).toMatchObject([
			{
				mediaSourceId: "source-1",
				filePath: "image.png",
				fileName: "image.png",
				mediaType: "image",
			},
		]);
		expect(addedEvents).toMatchObject([
			{ mediaSourceId: "source-1", mediaId: "media-1", filePath: "image.png" },
		]);
		expect(enqueuedJobs).toEqual([
			{ sourceId: "source-1", mediaId: "media-1", sourcePath: "/library" },
		]);
	});

	it("does not enqueue existing files during full sync", async () => {
		const { runtime, addedEvents, enqueuedJobs } = createTestRuntime({
			files: new Set(["/library/image.png"]),
			directories: new Map([["/library", ["image.png"]]]),
			existing: [{ id: "media-existing", filePath: "image.png" }],
		});

		const result = await runtime.syncLocalSource(source);

		expect(result.added).toBe(0);
		expect(addedEvents).toEqual([]);
		expect(enqueuedJobs).toEqual([]);
	});

	it("deletes missing files and publishes media-deleted", async () => {
		const { runtime, deletedIds, deletedEvents } = createTestRuntime({
			files: new Set(),
			directories: new Map([["/library", []]]),
			existing: [{ id: "media-stale", filePath: "stale.png" }],
		});

		const result = await runtime.syncLocalSource(source);

		expect(result.deleted).toBe(1);
		expect(deletedIds).toEqual(["media-stale"]);
		expect(deletedEvents).toMatchObject([
			{
				mediaSourceId: "source-1",
				mediaId: "media-stale",
				filePath: "stale.png",
			},
		]);
	});

	it("deletes a watched directory by path prefix", async () => {
		const { runtime, deletedPrefixes, deletedEvents } = createTestRuntime({
			files: new Set(),
			directories: new Map([["/library", []]]),
			existing: [
				{ id: "media-nested", filePath: "folder/nested.png" },
				{ id: "media-other", filePath: "other.png" },
			],
		});

		await runtime.reconcileWatchedPath(source, "/library/folder");

		expect(deletedPrefixes).toEqual(["folder"]);
		expect(deletedEvents).toMatchObject([
			{
				mediaSourceId: "source-1",
				mediaId: "media-nested",
				filePath: "folder/nested.png",
			},
		]);
	});

	it("drops malformed source watch event payloads", () => {
		expect(parseSourceWatchEventPayload(null)).toBeNull();
		expect(
			parseSourceWatchEventPayload({ mediaSourceId: "source-1" }),
		).toBeNull();
		expect(parseSourceWatchEventPayload({ paths: ["/path"] })).toBeNull();
		expect(
			parseSourceWatchEventPayload({
				mediaSourceId: "source-1",
				paths: ["/path", 1, null],
				timestamp: "2026-01-01T00:00:00Z",
			}),
		).toEqual({
			mediaSourceId: "source-1",
			paths: ["/path"],
			timestamp: "2026-01-01T00:00:00Z",
		});
	});
});

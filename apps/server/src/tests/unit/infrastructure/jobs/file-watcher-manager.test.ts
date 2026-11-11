import { EventEmitter } from "node:events";
import chokidar, { type FSWatcher } from "chokidar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileWatcherManager } from "~/infrastructure/jobs/file-watcher-manager";

vi.mock("chokidar", () => ({ default: { watch: vi.fn() } }));
vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishSource: vi.fn() },
}));
vi.mock("~/infrastructure/logger", () => ({ logger: { error: vi.fn() } }));

const callbacks = () => ({
	onAdd: vi.fn(async () => {}),
	onDelete: vi.fn(async () => {}),
	onChange: vi.fn(async () => {}),
});
const handles: Array<EventEmitter & { close: ReturnType<typeof vi.fn> }> = [];
const sourceIds = new Set<string>();
let autoReady = true;
function sourceId(name: string) {
	sourceIds.add(name);
	return name;
}

beforeEach(() => {
	vi.clearAllMocks();
	autoReady = true;
	vi.mocked(chokidar.watch).mockImplementation(() => {
		const watcher = Object.assign(new EventEmitter(), {
			close: vi.fn(async () => {}),
		});
		handles.push(watcher);
		if (autoReady) queueMicrotask(() => watcher.emit("ready"));
		return watcher as unknown as FSWatcher;
	});
});
afterEach(async () => {
	for (const id of sourceIds) await FileWatcherManager.stop(id);
	sourceIds.clear();
	handles.splice(0);
});

describe("watcher lifecycle ownership", () => {
	it("waits for initial watcher readiness before reporting a successful start", async () => {
		autoReady = false;
		const starting = FileWatcherManager.start(
			sourceId("ready-gate"),
			"/source",
			callbacks(),
		);
		let finished = false;
		void starting.then(() => {
			finished = true;
		});
		await vi.waitFor(() => expect(handles).toHaveLength(1));
		expect(finished).toBe(false);
		handles[0].emit("ready");
		expect(await starting).toBe(true);
	});

	it("allows stop to close a handle that never becomes ready", async () => {
		autoReady = false;
		const id = sourceId("stop-before-ready");
		const starting = FileWatcherManager.start(id, "/source", callbacks());
		await vi.waitFor(() => expect(handles).toHaveLength(1));
		await FileWatcherManager.stop(id);
		expect(await starting).toBe(false);
		expect(handles[0].close).toHaveBeenCalledOnce();
	});

	it("does not report readiness when initialization emits an error", async () => {
		autoReady = false;
		const starting = FileWatcherManager.start(
			sourceId("error-before-ready"),
			"/source",
			callbacks(),
		);
		await vi.waitFor(() => expect(handles).toHaveLength(1));
		handles[0].emit("error", new Error("watch failed"));
		expect(await starting).toBe(false);
	});

	it("invalidates prepared starts when stop completes", async () => {
		const id = sourceId("prepared");
		const generation = FileWatcherManager.beginStart(id);
		await FileWatcherManager.prepareStart(id, generation);
		await FileWatcherManager.stop(id);
		await FileWatcherManager.start(id, "/source", callbacks(), generation);
		expect(chokidar.watch).not.toHaveBeenCalled();
	});

	it("serializes replacement handles and lets only the latest concurrent start register", async () => {
		const id = sourceId("parallel-start");
		await FileWatcherManager.start(id, "/old", callbacks());
		const closing = Promise.withResolvers<void>();
		handles[0].close.mockReturnValueOnce(closing.promise);
		const first = FileWatcherManager.start(id, "/first", callbacks());
		await vi.waitFor(() => expect(handles[0].close).toHaveBeenCalled());
		const second = FileWatcherManager.start(id, "/second", callbacks());
		closing.resolve();
		await Promise.all([first, second]);
		expect(chokidar.watch).toHaveBeenCalledTimes(2);
		expect(chokidar.watch).toHaveBeenLastCalledWith(
			"/second",
			expect.any(Object),
		);
		await FileWatcherManager.stop(id);
		expect(
			handles.every((handle) => handle.close.mock.calls.length === 1),
		).toBe(true);
	});

	it("does not recreate a handle when stop arrives while the old handle is closing", async () => {
		const id = sourceId("stop-replacement");
		await FileWatcherManager.start(id, "/old", callbacks());
		const closing = Promise.withResolvers<void>();
		handles[0].close.mockReturnValueOnce(closing.promise);
		const starting = FileWatcherManager.start(id, "/new", callbacks());
		await vi.waitFor(() => expect(handles[0].close).toHaveBeenCalled());
		const stopping = FileWatcherManager.stop(id);
		closing.resolve();
		await Promise.all([starting, stopping]);
		expect(chokidar.watch).toHaveBeenCalledTimes(1);
		expect(handles[0].close).toHaveBeenCalledTimes(1);
	});

	it("retains failed-close handles for retry instead of orphaning or replacing them", async () => {
		const id = sourceId("close-failure");
		await FileWatcherManager.start(id, "/old", callbacks());
		handles[0].close.mockRejectedValueOnce(new Error("close failed"));
		await expect(
			FileWatcherManager.start(id, "/new", callbacks()),
		).rejects.toThrow("close failed");
		expect(chokidar.watch).toHaveBeenCalledTimes(1);
		await FileWatcherManager.stop(id);
		expect(handles[0].close).toHaveBeenCalledTimes(2);
	});

	it("suppresses events from an invalidated generation while its close is pending", async () => {
		const id = sourceId("old-events");
		const handlers = callbacks();
		await FileWatcherManager.start(id, "/old", handlers);
		const closing = Promise.withResolvers<void>();
		handles[0].close.mockReturnValueOnce(closing.promise);
		const stopping = FileWatcherManager.stop(id);
		handles[0].emit("add", "/old/stale.png");
		expect(handlers.onAdd).not.toHaveBeenCalled();
		closing.resolve();
		await stopping;
	});
});

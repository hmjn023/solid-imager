import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

const IGNORE_DOTFILES_REGEX = /(^|[/\\])\../;

type FileWatcher = {
	watcher: FSWatcher;
	path: string;
	settleReady: (ready: boolean) => void;
};

const globalWatchers = globalThis as typeof globalThis & {
	__FILE_WATCHERS_MAP__?: Map<string, FileWatcher>;
	__FILE_WATCHERS_GENERATIONS__?: Map<string, number>;
	__FILE_WATCHERS_OPERATIONS__?: Map<string, Promise<void>>;
	__FILE_WATCHERS_CLEANUP_REGISTERED__?: boolean;
};

globalWatchers.__FILE_WATCHERS_MAP__ ??= new Map<string, FileWatcher>();
const watchers = globalWatchers.__FILE_WATCHERS_MAP__;
const generations = (globalWatchers.__FILE_WATCHERS_GENERATIONS__ ??= new Map<
	string,
	number
>());
const operations = (globalWatchers.__FILE_WATCHERS_OPERATIONS__ ??= new Map<
	string,
	Promise<void>
>());

function nextGeneration(mediaSourceId: string): number {
	const generation = (generations.get(mediaSourceId) ?? 0) + 1;
	generations.set(mediaSourceId, generation);
	return generation;
}

function serialize(
	mediaSourceId: string,
	operation: () => Promise<void>,
): Promise<void> {
	const previous = operations.get(mediaSourceId) ?? Promise.resolve();
	const pending = previous.catch(() => {}).then(operation);
	operations.set(mediaSourceId, pending);
	void pending
		.finally(() => {
			if (operations.get(mediaSourceId) === pending)
				operations.delete(mediaSourceId);
		})
		.catch(() => {});
	return pending;
}

async function closeWatcher(mediaSourceId: string): Promise<void> {
	const entry = watchers.get(mediaSourceId);
	if (!entry) return;
	entry.settleReady(false);
	// A failed close stays registered so a later stop can retry it. Never orphan a handle.
	await entry.watcher.close();
	watchers.delete(mediaSourceId);
}

if (!globalWatchers.__FILE_WATCHERS_CLEANUP_REGISTERED__) {
	const cleanup = async () => {
		await Promise.all(
			Array.from(new Set([...generations.keys(), ...watchers.keys()])).map(
				async (mediaSourceId) => {
					nextGeneration(mediaSourceId);
					try {
						await serialize(mediaSourceId, () => closeWatcher(mediaSourceId));
					} catch (err) {
						logger.error(
							{ err, mediaSourceId },
							"Failed to close watcher during cleanup",
						);
					}
				},
			),
		);
	};

	process.on("SIGINT", () => {
		void cleanup();
	});
	process.on("SIGTERM", () => {
		void cleanup();
	});
	globalWatchers.__FILE_WATCHERS_CLEANUP_REGISTERED__ = true;
}

export const FileWatcherManager = {
	/** Reserve before asynchronous preparation; stop invalidates this request immediately. */
	beginStart(mediaSourceId: string): number {
		return nextGeneration(mediaSourceId);
	},

	isCurrentStart(mediaSourceId: string, generation: number): boolean {
		return generations.get(mediaSourceId) === generation;
	},

	async prepareStart(mediaSourceId: string, generation: number): Promise<void> {
		await serialize(mediaSourceId, async () => {
			if (this.isCurrentStart(mediaSourceId, generation))
				await closeWatcher(mediaSourceId);
		});
	},

	async start(
		mediaSourceId: string,
		watchPath: string,
		callbacks: {
			onAdd: (filePath: string) => Promise<void>;
			onDelete: (filePath: string) => Promise<void>;
			onChange: (filePath: string) => Promise<void>;
		},
		generation = nextGeneration(mediaSourceId),
	): Promise<boolean> {
		let readiness: Promise<boolean> = Promise.resolve(false);
		await serialize(mediaSourceId, async () => {
			if (!this.isCurrentStart(mediaSourceId, generation)) return;
			await closeWatcher(mediaSourceId);
			if (!this.isCurrentStart(mediaSourceId, generation)) return;

			const watcher = chokidar.watch(watchPath, {
				ignored: IGNORE_DOTFILES_REGEX,
				persistent: true,
				ignoreInitial: true,
				awaitWriteFinish: {
					stabilityThreshold: 2000,
					pollInterval: 100,
				},
			});
			const ready = Promise.withResolvers<boolean>();
			readiness = ready.promise;
			watcher.once("ready", () => ready.resolve(true));

			const run = async (
				callback: (filePath: string) => Promise<void>,
				filePath: string,
			) => {
				if (!this.isCurrentStart(mediaSourceId, generation)) return;
				try {
					await callback(path.relative(watchPath, filePath));
				} catch {
					// Callback owns contextual error logging.
				}
			};

			watcher.on("add", (filePath) => {
				void run(callbacks.onAdd, filePath);
			});
			watcher.on("unlink", (filePath) => {
				void run(callbacks.onDelete, filePath);
			});
			watcher.on("change", (filePath) => {
				void run(callbacks.onChange, filePath);
			});
			watcher.on("error", (error) => {
				ready.resolve(false);
				if (!this.isCurrentStart(mediaSourceId, generation)) return;
				const isUuid =
					/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
						mediaSourceId,
					);
				try {
					RealtimeEventBus.publishSource(mediaSourceId, "watcher-error", {
						mediaSourceId: isUuid ? mediaSourceId : undefined,
						error: String(error),
						timestamp: new Date().toISOString(),
					});
				} catch (publishError) {
					logger.error(
						{ err: publishError, mediaSourceId, originalError: error },
						"Failed to publish watcher error event",
					);
				}
			});

			watchers.set(mediaSourceId, {
				watcher,
				path: watchPath,
				settleReady: ready.resolve,
			});
		});
		// Do not hold the operation queue while waiting for IO. Stop/replacement
		// must be able to close an unready handle and settle this wait.
		return (await readiness) && this.isCurrentStart(mediaSourceId, generation);
	},

	async stop(mediaSourceId: string): Promise<void> {
		nextGeneration(mediaSourceId);
		await serialize(mediaSourceId, () => closeWatcher(mediaSourceId));
	},
};

import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

const IGNORE_DOTFILES_REGEX = /(^|[/\\])\../;

type FileWatcher = {
	watcher: FSWatcher;
	path: string;
};

const globalWatchers = globalThis as typeof globalThis & {
	__FILE_WATCHERS_MAP__?: Map<string, FileWatcher>;
	__FILE_WATCHERS_CLEANUP_REGISTERED__?: boolean;
};

globalWatchers.__FILE_WATCHERS_MAP__ ??= new Map<string, FileWatcher>();
const watchers = globalWatchers.__FILE_WATCHERS_MAP__;

if (!globalWatchers.__FILE_WATCHERS_CLEANUP_REGISTERED__) {
	const cleanup = async () => {
		await Promise.all(
			Array.from(watchers.values()).map(async (entry) => {
				try {
					await entry.watcher.close();
				} catch (err) {
					logger.error(
						{ err, path: entry.path },
						"Failed to close watcher during cleanup",
					);
				}
			}),
		);
		watchers.clear();
	};

	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);
	globalWatchers.__FILE_WATCHERS_CLEANUP_REGISTERED__ = true;
}

export const FileWatcherManager = {
	async start(
		mediaSourceId: string,
		watchPath: string,
		callbacks: {
			onAdd: (filePath: string) => Promise<void>;
			onDelete: (filePath: string) => Promise<void>;
			onChange: (filePath: string) => Promise<void>;
		},
	): Promise<void> {
		await this.stop(mediaSourceId);

		const watcher = chokidar.watch(watchPath, {
			ignored: IGNORE_DOTFILES_REGEX,
			persistent: true,
			ignoreInitial: true,
			awaitWriteFinish: {
				stabilityThreshold: 2000,
				pollInterval: 100,
			},
		});

		const run = async (
			callback: (filePath: string) => Promise<void>,
			filePath: string,
		) => {
			try {
				await callback(path.relative(watchPath, filePath));
			} catch {
				// Callback owns contextual error logging.
			}
		};

		watcher.on("add", (filePath) => run(callbacks.onAdd, filePath));
		watcher.on("unlink", (filePath) => run(callbacks.onDelete, filePath));
		watcher.on("change", (filePath) => run(callbacks.onChange, filePath));
		watcher.on("error", (error) => {
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

		watchers.set(mediaSourceId, { watcher, path: watchPath });
	},

	async stop(mediaSourceId: string): Promise<void> {
		const entry = watchers.get(mediaSourceId);
		if (!entry) {
			return;
		}
		try {
			await entry.watcher.close();
		} catch (err) {
			logger.error(
				{ err, mediaSourceId },
				"Failed to close watcher in stop method",
			);
		}
		watchers.delete(mediaSourceId);
	},
};

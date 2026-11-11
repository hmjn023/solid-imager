import { createTauriSQLitePersistence } from "@tanstack/tauri-db-sqlite-persistence";
import Database from "@tauri-apps/plugin-sql";
import { getDatabaseName } from "./database-files";

/** Normalize native string errors and reject calls through a retired connection. */
function wrapDatabaseWithErrorNormalization(
	initialDatabase: InstanceType<typeof Database>,
) {
	let database = initialDatabase;
	let closed = false;
	const assertOpen = () => {
		if (closed) throw new Error("This persistence connection has been closed.");
	};
	const retire = async (recoverOnFailure = false) => {
		try {
			await database.close();
			closed = true;
		} catch (error) {
			// Native close may reject after releasing the handle. Reopen the same
			// cache behind this facade so existing collections remain usable.
			closed = true;
			if (recoverOnFailure) {
				try {
					database = await Database.load(initialDatabase.path);
					closed = false;
				} catch (recoveryError) {
					throw new AggregateError(
						[error, recoveryError],
						"Failed to close and restore the current database.",
					);
				}
			}
			throw error;
		}
	};
	return {
		path: database.path,
		execute: async (query: string, bindValues?: unknown[]) => {
			assertOpen();
			try {
				return await database.execute(query, bindValues);
			} catch (error) {
				throw typeof error === "string" ? new Error(error) : error;
			}
		},
		select: async <T>(query: string, bindValues?: unknown[]): Promise<T> => {
			assertOpen();
			try {
				return await database.select<T>(query, bindValues);
			} catch (error) {
				throw typeof error === "string" ? new Error(error) : error;
			}
		},
		isOpen: () => !closed,
		reopen: async () => {
			if (!closed) return;
			database = await Database.load(initialDatabase.path);
			closed = false;
		},
		close: async () => {
			await retire();
			return true;
		},
		retire,
	};
}

type Connection = {
	serverId: string | null;
	persistence: ReturnType<typeof createTauriSQLitePersistence>;
	close: (recoverOnFailure?: boolean) => Promise<void>;
	isOpen: () => boolean;
	reopen: () => Promise<void>;
};
let activeConnection: Connection | null = null;
let operation: Promise<void> = Promise.resolve();

function serialize<T>(action: () => Promise<T>): Promise<T> {
	const next = operation.then(action, action);
	operation = next.then(
		() => {},
		() => {},
	);
	return next;
}

async function createConnection(serverId: string | null): Promise<Connection> {
	const database = await Database.load(`sqlite:${getDatabaseName(serverId)}`);
	const normalized = wrapDatabaseWithErrorNormalization(database);
	try {
		return {
			serverId,
			persistence: createTauriSQLitePersistence({ database: normalized }),
			close: normalized.retire,
			isOpen: normalized.isOpen,
			reopen: normalized.reopen,
		};
	} catch (error) {
		await normalized.retire();
		throw error;
	}
}

/** Opens one server's SQLite connection, coalescing concurrent initialization. */
export function initializePersistence(serverId?: string | null) {
	const requestedId = serverId ?? null;
	return serialize(async () => {
		if (activeConnection) {
			if (activeConnection.serverId !== requestedId)
				throw new Error(
					"Close or replace the active persistence before changing servers.",
				);
			await activeConnection.reopen();
			return activeConnection.persistence;
		}
		activeConnection = await createConnection(requestedId);
		return activeConnection.persistence;
	});
}

/** Returns the cache identity actually open in the runtime, independently of saved settings. */
export function getPersistenceServerId(): string | null | undefined {
	return activeConnection?.serverId;
}

/**
 * Prepares a replacement before saving configuration, then retires the old connection.
 * A failed preparation, save, or close leaves the old connection available.
 */
export function replacePersistence(
	serverId: string | null,
	commitSettings: () => Promise<void>,
	publishSettings: () => void = () => {},
): Promise<void> {
	return serialize(async () => {
		const previous = activeConnection;
		if (previous?.serverId === serverId) {
			await commitSettings();
			publishSettings();
			return;
		}
		const candidate =
			serverId === null ? null : await createConnection(serverId);
		try {
			await commitSettings();
			await previous?.close(true);
		} catch (error) {
			try {
				await candidate?.close();
			} catch (cleanupError) {
				console.error(
					"Failed to close an unused server connection",
					cleanupError,
				);
			}
			throw error;
		}
		activeConnection = candidate;
		publishSettings();
	});
}

/** Clears the active connection only after the native database closes successfully. */
export function closePersistence(): Promise<void> {
	return serialize(async () => {
		const previous = activeConnection;
		await previous?.close(true);
		activeConnection = null;
	});
}

/** Returns persistence bound to the current runtime connection. */
export function getPersistence() {
	if (!activeConnection || !activeConnection.isOpen())
		throw new Error(
			"Persistence not initialized. Call initializePersistence() first.",
		);
	return activeConnection.persistence;
}

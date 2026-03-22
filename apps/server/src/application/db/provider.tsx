import { onMount, type ParentComponent } from "solid-js";
import { logger } from "~/infrastructure/logger";
import { SyncManager } from "./sync-manager";

/**
 * Provider component that initializes local DB and collections
 * when the application mounts.
 *
 * Provides an entry point for TanStack DB and PGLite sync.
 */
export const TanStackDbProvider: ParentComponent = (props) => {
	onMount(() => {
		// Initialize the sync process on app mount
		// This connects to PGLite and starts syncing TanStack DB collections
		// The collections manage their own TanStack Query integration
		SyncManager.init().catch((error) => {
			logger.error({ error }, "Failed to initialize TanStack DB Provider sync");
		});

		// Optional: set up real-time listener or periodic sync here
		// const intervalId = setInterval(() => SyncManager.syncAll(), 60000);
		// return () => clearInterval(intervalId);
	});

	return (
		<>
			{/* TanStack DB doesn't require a strict Context Provider for collections since they are
          global reactive variables using @tanstack/solid-db */}
			{props.children}
		</>
	);
};

// Export context or utilities if needed
export { SyncManager } from "./sync-manager";

import { isServer } from "solid-js/web";

/** Starts a best-effort prefetch in the browser only; rejected prefetches do not interrupt rendering. */
export function prefetchQueryOnClient(prefetch: () => Promise<unknown>): void {
	if (!isServer) {
		void prefetch().catch(() => undefined);
	}
}

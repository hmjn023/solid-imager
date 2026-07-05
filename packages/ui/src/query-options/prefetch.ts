import { isServer } from "solid-js/web";

export function prefetchQueryOnClient(prefetch: () => Promise<unknown>): void {
	if (!isServer) {
		void prefetch();
	}
}

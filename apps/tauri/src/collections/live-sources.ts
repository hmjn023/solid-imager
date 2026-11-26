import { createSignal, onSettled } from "solid-js";
import type { createSourcesCollection } from "./sources-collection";

export function observeSources(
	sources: ReturnType<typeof createSourcesCollection>,
) {
	const read = () => ({ rows: sources.toArray, isReady: sources.isReady() });
	const [snapshot, setSnapshot] = createSignal(read());
	onSettled(() => {
		const publish = () => setSnapshot(read());
		const unsubscribeStatus = sources.on("status:change", publish);
		const subscription = sources.subscribeChanges(publish, {
			includeInitialState: true,
		});
		publish();
		return () => {
			subscription.unsubscribe();
			unsubscribeStatus();
		};
	});
	return snapshot;
}

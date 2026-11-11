import { getClient } from "./api";
import { readConnectionSettings } from "./connection-settings";
import type { ConnectionSettings } from "./schema";
import { resolveEffectiveSourceId } from "./utils/source-selection";
import { retryWithBackoff } from "./utils/retry";

/** Capture once, then resolve every request/retry against that same server and selection. */
export async function resolveDestination(settings?: ConnectionSettings) {
	const snapshot = settings ?? (await readConnectionSettings());
	const client = await getClient(snapshot.apiUrl);
	const returnedSources = await retryWithBackoff(() => client.sources.list());
	const sources = returnedSources.flatMap((source) =>
		source.id ? [{ id: source.id, name: source.name, type: source.type }] : [],
	);
	const selected = resolveEffectiveSourceId(
		sources,
		snapshot.selectedSourceIds[snapshot.apiUrl],
		"twitter",
	);
	return {
		client,
		settings: snapshot,
		sources,
		selectedSourceId: selected?.id ?? null,
	};
}

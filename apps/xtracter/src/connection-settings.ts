import { connectionSettingsSchema, type ConnectionSettings } from "./schema";

export const DEFAULT_API_URL = "http://localhost:3000/api/rpc";

/** Read the URL and its saved source from a single storage snapshot. */
export async function readConnectionSettings(): Promise<ConnectionSettings> {
	const stored = await chrome.storage.local.get([
		"connectionSettings",
		"apiUrl",
		"selectedSourceId",
	]);
	if (stored.connectionSettings !== undefined)
		return connectionSettingsSchema.parse(stored.connectionSettings);
	// The old global selection belongs only to the URL saved alongside it.
	const apiUrl =
		typeof stored.apiUrl === "string" && stored.apiUrl
			? stored.apiUrl
			: DEFAULT_API_URL;
	return connectionSettingsSchema.parse({
		apiUrl,
		generation: 0,
		selectedSourceIds:
			typeof stored.selectedSourceId === "string"
				? { [apiUrl]: stored.selectedSourceId }
				: {},
	});
}

// Settings mutations are handled in the background only. Serialize read/modify/write,
// including failures, so two popup edits cannot lose a server's saved selection.
let pendingWrite: Promise<void> = Promise.resolve();
export function updateConnectionSettings(
	change: (current: ConnectionSettings) => ConnectionSettings,
): Promise<ConnectionSettings> {
	const write = pendingWrite.then(async () => {
		const next = connectionSettingsSchema.parse(
			change(await readConnectionSettings()),
		);
		await chrome.storage.local.set({ connectionSettings: next });
		return next;
	});
	pendingWrite = write.then(
		() => {},
		() => {},
	);
	return write;
}

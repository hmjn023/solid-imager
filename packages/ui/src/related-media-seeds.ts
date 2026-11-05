import { relatedMediaRequestSchema } from "@solid-imager/core/media";
import { UI_STORAGE_KEYS } from "./ui-storage";

const MAX_SAVED_SEEDS = 100;
const entrySchema = relatedMediaRequestSchema.pick({
	sourceId: true,
	mediaId: true,
	seed: true,
});
const savedSeedsSchema = entrySchema.array().max(MAX_SAVED_SEEDS);

export function createRelatedMediaSeed(): string {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
	);
}

/** Bounded session state; memory remains usable when browser storage is blocked. */
export function createRelatedMediaSeedStore(
	storage?: Pick<Storage, "getItem" | "setItem">,
	createSeed: () => string = createRelatedMediaSeed,
) {
	const entries = new Map<string, ReturnType<typeof entrySchema.parse>>();
	const keyFor = (sourceId: string, mediaId: string) =>
		`${sourceId}/${mediaId}`;
	try {
		const stored = storage?.getItem(UI_STORAGE_KEYS.relatedMediaSeeds);
		const parsed = savedSeedsSchema.safeParse(stored ? JSON.parse(stored) : []);
		if (parsed.success) {
			for (const entry of parsed.data) {
				entries.set(keyFor(entry.sourceId, entry.mediaId), entry);
			}
		}
	} catch {
		// Invalid or blocked optional persistence must not prevent recommendations.
	}

	const save = (sourceId: string, mediaId: string, seed: string) => {
		const key = keyFor(sourceId, mediaId);
		entries.delete(key);
		entries.set(key, { sourceId, mediaId, seed });
		if (entries.size > MAX_SAVED_SEEDS) {
			const oldest = entries.keys().next().value;
			if (oldest !== undefined) entries.delete(oldest);
		}
		try {
			storage?.setItem(
				UI_STORAGE_KEYS.relatedMediaSeeds,
				JSON.stringify([...entries.values()]),
			);
		} catch {
			// Keep the in-memory entry when storage is full or disabled.
		}
		return seed;
	};
	return {
		get(sourceId: string, mediaId: string) {
			const existing = entries.get(keyFor(sourceId, mediaId));
			return save(sourceId, mediaId, existing?.seed ?? createSeed());
		},
		save,
	};
}

type RelatedMediaSeedStore = ReturnType<typeof createRelatedMediaSeedStore>;

// Only mounted browser components enter this map; SSR never retains user state.
const browserStores = new WeakMap<Window, RelatedMediaSeedStore>();

export function getBrowserRelatedMediaSeedStore(
	browser: Window,
): RelatedMediaSeedStore {
	const existing = browserStores.get(browser);
	if (existing) return existing;
	let storage: Storage | undefined;
	try {
		storage = browser.sessionStorage;
	} catch {
		// The per-window memory store still preserves Back navigation.
	}
	const store = createRelatedMediaSeedStore(storage);
	browserStores.set(browser, store);
	return store;
}

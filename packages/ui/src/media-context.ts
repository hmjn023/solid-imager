import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	mediaIdSchema,
	mediaSourceIdSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	readUiStorageValue,
	removeUiStorageValue,
	UI_STORAGE_KEYS,
} from "./ui-storage";

const MAX_CONTEXT_ITEMS = 500;

export type MediaContextItem = Pick<Media, "id" | "mediaSourceId">;

export type StoredMediaContext = {
	items: MediaContextItem[];
	returnPath: string;
	returnHistoryIndex?: number;
	updatedAt: number;
};

function getStorage(): Storage | null {
	try {
		return typeof sessionStorage === "undefined" ? null : sessionStorage;
	} catch {
		return null;
	}
}

function writeStorageValue(
	storage: Storage,
	key: string,
	value: string,
): boolean {
	try {
		storage.setItem(key, value);
		return storage.getItem(key) === value;
	} catch {
		return false;
	}
}

export function saveMediaContext(
	returnPath: string,
	items: readonly MediaContextItem[],
): void {
	const storage = getStorage();
	if (!storage) return;

	const uniqueItems = new Map<string, MediaContextItem>();
	for (const item of items) {
		if (
			mediaIdSchema.safeParse(item.id).success &&
			mediaSourceIdSchema.safeParse(item.mediaSourceId).success
		) {
			uniqueItems.set(item.id, {
				id: item.id,
				mediaSourceId: item.mediaSourceId,
			});
		}
		if (uniqueItems.size >= MAX_CONTEXT_ITEMS) break;
	}

	const historyState: unknown =
		typeof window === "undefined" ? undefined : window.history.state;
	const returnHistoryIndex =
		isRecord(historyState) && Number.isInteger(historyState.__TSR_index)
			? historyState.__TSR_index
			: undefined;
	const context: StoredMediaContext = {
		items: [...uniqueItems.values()],
		returnPath,
		...(typeof returnHistoryIndex === "number" && returnHistoryIndex >= 0
			? { returnHistoryIndex }
			: {}),
		updatedAt: Date.now(),
	};
	const serialized = JSON.stringify(context);

	// Each write is independent. A full session store should not prevent the
	// other value from being retained or make detail navigation throw.
	writeStorageValue(storage, UI_STORAGE_KEYS.mediaContext, serialized);
	writeStorageValue(storage, UI_STORAGE_KEYS.mediaReturn, returnPath);
}

export function readMediaContext(): StoredMediaContext | null {
	const storage = getStorage();
	if (!storage) return null;

	try {
		const raw = readUiStorageValue(storage, UI_STORAGE_KEYS.mediaContext);
		if (!raw) return null;
		const value: unknown = JSON.parse(raw);
		if (!isRecord(value) || !Array.isArray(value.items)) return null;

		const items = value.items.flatMap((item) => {
			if (!isRecord(item)) return [];
			const mediaId = mediaIdSchema.safeParse(item.id);
			const mediaSourceId = mediaSourceIdSchema.safeParse(item.mediaSourceId);
			return mediaId.success && mediaSourceId.success
				? [{ id: mediaId.data, mediaSourceId: mediaSourceId.data }]
				: [];
		});
		if (typeof value.returnPath !== "string") return null;

		return {
			items,
			returnPath: value.returnPath,
			...(typeof value.returnHistoryIndex === "number" &&
			Number.isInteger(value.returnHistoryIndex) &&
			value.returnHistoryIndex >= 0
				? { returnHistoryIndex: value.returnHistoryIndex }
				: {}),
			updatedAt:
				typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
		};
	} catch {
		return null;
	}
}

export function readMediaReturnPath(): string | null {
	const storage = getStorage();
	return storage
		? readUiStorageValue(storage, UI_STORAGE_KEYS.mediaReturn)
		: null;
}

export function clearMediaReturnPath(): void {
	const storage = getStorage();
	if (!storage) return;
	removeUiStorageValue(storage, UI_STORAGE_KEYS.mediaReturn);
}

export function findMediaNeighbors(mediaId: string): {
	next: MediaContextItem | undefined;
	previous: MediaContextItem | undefined;
} {
	const context = readMediaContext();
	if (!context) return { next: undefined, previous: undefined };
	const index = context.items.findIndex((item) => item.id === mediaId);
	if (index < 0) return { next: undefined, previous: undefined };
	return {
		next: context.items[index + 1],
		previous: index > 0 ? context.items[index - 1] : undefined,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

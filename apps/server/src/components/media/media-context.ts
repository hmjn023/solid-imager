import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	mediaIdSchema,
	mediaSourceIdSchema,
} from "@solid-imager/core/domain/media/schemas";

const STORAGE_KEY = "v2:media-context";
const MAX_CONTEXT_ITEMS = 500;

export type MediaContextItem = Pick<Media, "id" | "mediaSourceId">;

type StoredMediaContext = {
	items: MediaContextItem[];
	returnPath: string;
	updatedAt: number;
};

function getStorage(): Storage | null {
	try {
		return typeof sessionStorage === "undefined" ? null : sessionStorage;
	} catch {
		return null;
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

	try {
		storage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				items: [...uniqueItems.values()],
				returnPath,
				updatedAt: Date.now(),
			} satisfies StoredMediaContext),
		);
	} catch {
		// Session storage is an enhancement; navigation remains usable without it.
	}
}

export function readMediaContext(): StoredMediaContext | null {
	const storage = getStorage();
	if (!storage) return null;

	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const value: unknown = JSON.parse(raw);
		if (!isRecord(value) || typeof value.returnPath !== "string") return null;
		if (!Array.isArray(value.items)) return null;

		const items = value.items.flatMap((item) => {
			if (!isRecord(item)) return [];
			const mediaId = mediaIdSchema.safeParse(item.id);
			const mediaSourceId = mediaSourceIdSchema.safeParse(item.mediaSourceId);
			return mediaId.success && mediaSourceId.success
				? [{ id: mediaId.data, mediaSourceId: mediaSourceId.data }]
				: [];
		});
		return {
			items,
			returnPath: value.returnPath,
			updatedAt:
				typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
		};
	} catch {
		return null;
	}
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

export type CollectionNavigationKey =
	| "ArrowDown"
	| "ArrowLeft"
	| "ArrowRight"
	| "ArrowUp"
	| "End"
	| "Home"
	| "PageDown"
	| "PageUp";

const COLLECTION_NAVIGATION_KEYS = new Set<string>([
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"End",
	"Home",
	"PageDown",
	"PageUp",
]);

export function isCollectionNavigationKey(
	key: string,
): key is CollectionNavigationKey {
	return COLLECTION_NAVIGATION_KEYS.has(key);
}

/**
 * Computes the clamped grid destination for a navigation key.
 *
 * @param options - Current index, collection size, grid columns, visible page rows, and key.
 * @returns The destination index, or null when the collection is empty.
 */
export function getCollectionNavigationIndex(options: {
	columnCount: number;
	currentIndex: number;
	itemCount: number;
	key: CollectionNavigationKey;
	pageRowCount: number;
}): number | null {
	if (options.itemCount <= 0) return null;

	const currentIndex = Math.min(
		Math.max(options.currentIndex, 0),
		options.itemCount - 1,
	);
	const columnCount = Math.max(options.columnCount, 1);
	const pageSize = columnCount * Math.max(options.pageRowCount, 1);
	let nextIndex = currentIndex;

	switch (options.key) {
		case "ArrowLeft":
			nextIndex -= 1;
			break;
		case "ArrowRight":
			nextIndex += 1;
			break;
		case "ArrowUp":
			nextIndex -= columnCount;
			break;
		case "ArrowDown":
			nextIndex += columnCount;
			break;
		case "Home":
			nextIndex = 0;
			break;
		case "End":
			nextIndex = options.itemCount - 1;
			break;
		case "PageUp":
			nextIndex -= pageSize;
			break;
		case "PageDown":
			nextIndex += pageSize;
			break;
	}

	return Math.min(Math.max(nextIndex, 0), options.itemCount - 1);
}

/** Keeps the current preview if present, otherwise selects the first item or null. */
export function reconcileCollectionPreviewId(
	items: readonly { id: string }[],
	currentId: string | null,
): string | null {
	if (currentId && items.some((item) => item.id === currentId)) {
		return currentId;
	}
	return items[0]?.id ?? null;
}

export function findCollectionItemById<T extends { id: string }>(
	items: readonly T[],
	itemId: string | null | undefined,
): T | undefined {
	if (!itemId) return undefined;
	return items.find((item) => item.id === itemId);
}

/** Tests whether the remaining scrollable distance is within the non-negative threshold. */
export function isCollectionScrollNearEnd(options: {
	contentSize: number;
	scrollOffset: number;
	threshold: number;
	viewportSize: number;
}): boolean {
	return (
		options.contentSize - (options.scrollOffset + options.viewportSize) <=
		Math.max(options.threshold, 0)
	);
}

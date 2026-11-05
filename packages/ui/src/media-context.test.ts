import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	clearMediaReturnPath,
	createRelatedMediaReturnMarker,
	findMediaNeighbors,
	getMediaReturnHistoryDelta,
	readMediaContext,
	readMediaReturnPath,
	saveMediaContext,
} from "./media-context";
import { UI_STORAGE_KEYS } from "./ui-storage";

const sourceId = "00000000-0000-4000-8000-000000000001";
const firstMediaId = "00000000-0000-4000-8000-000000000002";
const secondMediaId = "00000000-0000-4000-8000-000000000003";

class MemoryStorage implements Storage {
	private readonly values = new Map<string, string>();

	get length(): number {
		return this.values.size;
	}

	clear(): void {
		this.values.clear();
	}

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.values.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe("media detail context", () => {
	let storage: MemoryStorage;

	beforeEach(() => {
		storage = new MemoryStorage();
		Object.defineProperty(globalThis, "sessionStorage", {
			configurable: true,
			value: storage,
		});
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, "sessionStorage");
	});

	it("reads the current context and return values", () => {
		storage.setItem(
			UI_STORAGE_KEYS.mediaContext,
			JSON.stringify({
				items: [
					{ id: firstMediaId, mediaSourceId: sourceId },
					{ id: secondMediaId, mediaSourceId: sourceId },
				],
				returnPath: "/search?mode=grid#results",
				updatedAt: 1,
			}),
		);
		storage.setItem(UI_STORAGE_KEYS.mediaReturn, "/search?mode=grid#results");

		expect(readMediaContext()?.items).toEqual([
			{ id: firstMediaId, mediaSourceId: sourceId },
			{ id: secondMediaId, mediaSourceId: sourceId },
		]);
		expect(readMediaReturnPath()).toBe("/search?mode=grid#results");
		expect(findMediaNeighbors(firstMediaId)).toEqual({
			next: { id: secondMediaId, mediaSourceId: sourceId },
			previous: undefined,
		});
		expect(storage.getItem(UI_STORAGE_KEYS.mediaContext)).not.toBeNull();
		expect(storage.getItem(UI_STORAGE_KEYS.mediaReturn)).toBe(
			"/search?mode=grid#results",
		);
	});

	it("keeps canonical context and return values authoritative", () => {
		storage.setItem(
			UI_STORAGE_KEYS.mediaContext,
			JSON.stringify({
				items: [{ id: firstMediaId, mediaSourceId: sourceId }],
				returnPath: "/sources/current",
				updatedAt: 2,
			}),
		);
		storage.setItem(UI_STORAGE_KEYS.mediaReturn, "/search#current");

		expect(readMediaContext()?.returnPath).toBe("/sources/current");
		expect(readMediaReturnPath()).toBe("/search#current");
	});

	it("clears the current return path", () => {
		storage.setItem(UI_STORAGE_KEYS.mediaReturn, "/search#current");

		clearMediaReturnPath();

		expect(readMediaReturnPath()).toBeNull();
		expect(storage.getItem(UI_STORAGE_KEYS.mediaReturn)).toBeNull();
	});

	it("writes the canonical context and independent return value", () => {
		saveMediaContext("/search#results", [
			{ id: firstMediaId, mediaSourceId: sourceId },
			{ id: firstMediaId, mediaSourceId: sourceId },
			{ id: secondMediaId, mediaSourceId: sourceId },
		]);

		expect(readMediaContext()?.items).toHaveLength(2);
		expect(storage.getItem(UI_STORAGE_KEYS.mediaReturn)).toBe(
			"/search#results",
		);
	});

	const firstMedia = { id: firstMediaId, mediaSourceId: sourceId };
	const secondMedia = { id: secondMediaId, mediaSourceId: sourceId };
	const collectionContext = {
		items: [firstMedia, secondMedia],
		returnPath: "/search?snapshot=saved",
		returnHistoryIndex: 1,
		updatedAt: 123,
	};
	function saveCollectionContext() {
		storage.setItem(
			UI_STORAGE_KEYS.mediaContext,
			JSON.stringify(collectionContext),
		);
		storage.setItem(UI_STORAGE_KEYS.mediaReturn, collectionContext.returnPath);
	}

	it("returns through a related-image chain and keeps the chain across reloads", () => {
		saveCollectionContext();
		const secondState = {
			__TSR_index: 3,
			relatedMediaReturn: createRelatedMediaReturnMarker(
				{ __TSR_index: 2 },
				firstMedia,
				secondMedia,
			),
		};
		expect(
			getMediaReturnHistoryDelta(
				collectionContext,
				collectionContext.returnPath,
				secondState,
				secondMedia,
			),
		).toBe(-2);
		const thirdState = {
			__TSR_index: 4,
			relatedMediaReturn: createRelatedMediaReturnMarker(
				secondState,
				secondMedia,
				firstMedia,
			),
		};
		const reloadedState: unknown = JSON.parse(JSON.stringify(thirdState));
		expect(
			getMediaReturnHistoryDelta(
				readMediaContext(),
				collectionContext.returnPath,
				reloadedState,
				firstMedia,
			),
		).toBe(-3);
	});

	it("does not traverse or inherit stale collection history on a different branch", () => {
		saveCollectionContext();
		// The old collection at index 1 was replaced by Jobs; a Manager image is at 3.
		const unrelatedState = { __TSR_index: 3 };
		expect(
			getMediaReturnHistoryDelta(
				collectionContext,
				collectionContext.returnPath,
				unrelatedState,
				firstMedia,
			),
		).toBeUndefined();
		expect(
			createRelatedMediaReturnMarker(unrelatedState, firstMedia, secondMedia),
		).toBeUndefined();
		// Existing immediate collection -> detail navigation still uses browser Back.
		expect(
			getMediaReturnHistoryDelta(
				collectionContext,
				collectionContext.returnPath,
				{ __TSR_index: 2 },
				firstMedia,
			),
		).toBe(-1);
	});

	it("rejects a copied marker on a different detail, index, or collection context", () => {
		saveCollectionContext();
		const state = {
			__TSR_index: 3,
			relatedMediaReturn: createRelatedMediaReturnMarker(
				{ __TSR_index: 2 },
				firstMedia,
				secondMedia,
			),
		};
		expect(
			getMediaReturnHistoryDelta(
				collectionContext,
				collectionContext.returnPath,
				state,
				firstMedia,
			),
		).toBeUndefined();
		expect(
			createRelatedMediaReturnMarker(state, firstMedia, secondMedia),
		).toBeUndefined();
		expect(
			getMediaReturnHistoryDelta(
				collectionContext,
				collectionContext.returnPath,
				{ ...state, __TSR_index: 4 },
				secondMedia,
			),
		).toBeUndefined();
		expect(
			getMediaReturnHistoryDelta(
				{ ...collectionContext, updatedAt: 124 },
				collectionContext.returnPath,
				state,
				secondMedia,
			),
		).toBeUndefined();
	});

	it("preserves the collection return when previous/next replaces a related detail", () => {
		saveCollectionContext();
		const state = {
			__TSR_index: 3,
			relatedMediaReturn: createRelatedMediaReturnMarker(
				{ __TSR_index: 2 },
				firstMedia,
				secondMedia,
			),
		};
		const replacedState = {
			__TSR_index: 3,
			relatedMediaReturn: createRelatedMediaReturnMarker(
				state,
				secondMedia,
				firstMedia,
				true,
			),
		};
		expect(
			getMediaReturnHistoryDelta(
				collectionContext,
				collectionContext.returnPath,
				replacedState,
				firstMedia,
			),
		).toBe(-2);
		expect(
			getMediaReturnHistoryDelta(
				collectionContext,
				collectionContext.returnPath,
				replacedState,
				secondMedia,
			),
		).toBeUndefined();
	});
});

import { describe, expect, it } from "vitest";
import {
	findCollectionItemById,
	getCollectionNavigationIndex,
	isCollectionNavigationKey,
	isCollectionScrollNearEnd,
	reconcileCollectionPreviewId,
} from "./collection-navigation";

describe("collection navigation", () => {
	it("moves spatially and clamps at collection edges", () => {
		expect(
			getCollectionNavigationIndex({
				columnCount: 4,
				currentIndex: 5,
				itemCount: 10,
				key: "ArrowDown",
				pageRowCount: 2,
			}),
		).toBe(9);
		expect(
			getCollectionNavigationIndex({
				columnCount: 4,
				currentIndex: 2,
				itemCount: 10,
				key: "PageDown",
				pageRowCount: 2,
			}),
		).toBe(9);
		expect(
			getCollectionNavigationIndex({
				columnCount: 4,
				currentIndex: 0,
				itemCount: 10,
				key: "ArrowUp",
				pageRowCount: 2,
			}),
		).toBe(0);
	});

	it("recognizes only delegated collection navigation keys", () => {
		expect(isCollectionNavigationKey("Home")).toBe(true);
		expect(isCollectionNavigationKey("Enter")).toBe(false);
	});
});

describe("collection preview reconciliation", () => {
	const items = [{ id: "one" }, { id: "two" }];

	it("keeps a visible selection", () => {
		expect(reconcileCollectionPreviewId(items, "two")).toBe("two");
	});

	it("selects the first item when the previous selection disappears", () => {
		expect(reconcileCollectionPreviewId(items, "missing")).toBe("one");
		expect(reconcileCollectionPreviewId([], "missing")).toBeNull();
	});

	it("does not reuse a stale context-menu target", () => {
		expect(findCollectionItemById(items, "two")).toEqual({ id: "two" });
		expect(findCollectionItemById(items, "removed")).toBeUndefined();
		expect(findCollectionItemById(items, null)).toBeUndefined();
	});
});

describe("collection scroll threshold", () => {
	it("reports proximity without requiring an exact bottom position", () => {
		expect(
			isCollectionScrollNearEnd({
				contentSize: 2_000,
				scrollOffset: 1_100,
				threshold: 400,
				viewportSize: 500,
			}),
		).toBe(true);
		expect(
			isCollectionScrollNearEnd({
				contentSize: 2_000,
				scrollOffset: 800,
				threshold: 400,
				viewportSize: 500,
			}),
		).toBe(false);
	});
});

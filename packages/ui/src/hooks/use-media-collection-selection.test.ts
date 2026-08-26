import { describe, expect, it } from "vitest";
import {
	createEmptyMediaCollectionSelectionState,
	type MediaCollectionSelectionMode,
	type MediaCollectionSelectionState,
	reduceMediaCollectionSelection,
} from "./use-media-collection-selection";

const visibleIds = ["one", "two", "three", "four", "five", "six"] as const;

function select(
	state: MediaCollectionSelectionState,
	id: (typeof visibleIds)[number],
	mode: MediaCollectionSelectionMode = "replace",
): MediaCollectionSelectionState {
	return reduceMediaCollectionSelection(
		state,
		{ type: "select", id, mode },
		visibleIds,
	);
}

function expectSelection(
	state: MediaCollectionSelectionState,
	ids: readonly string[],
): void {
	expect([...state.selectedIds]).toEqual(ids);
}

describe("media collection selection", () => {
	it("plain selection replaces the selection and establishes every cursor", () => {
		let state = createEmptyMediaCollectionSelectionState();
		state = select(state, "one", "toggle");
		state = select(state, "three");

		expectSelection(state, ["three"]);
		expect(state.activeId).toBe("three");
		expect(state.anchorId).toBe("three");
		expect(state.focusedId).toBe("three");
	});

	it("Mod-style toggle adds and removes without mutating an earlier Set", () => {
		let state = select(createEmptyMediaCollectionSelectionState(), "one");
		const earlierSelectedIds = state.selectedIds;

		state = select(state, "three", "toggle");
		expectSelection(state, ["one", "three"]);
		expect([...earlierSelectedIds]).toEqual(["one"]);
		expect(state.activeId).toBe("three");

		state = select(state, "three", "toggle");
		expectSelection(state, ["one"]);
		expect(state.activeId).toBe("one");
		expect(state.anchorId).toBe("three");
		expect(state.focusedId).toBe("three");
	});

	it("Shift-style range replaces selection from the stable anchor", () => {
		let state = select(createEmptyMediaCollectionSelectionState(), "two");
		state = select(state, "five", "range");

		expectSelection(state, ["two", "three", "four", "five"]);
		expect(state.activeId).toBe("five");
		expect(state.anchorId).toBe("two");
		expect(state.focusedId).toBe("five");
	});

	it("Mod+Shift-style range adds to the existing selection", () => {
		let state = select(createEmptyMediaCollectionSelectionState(), "two");
		state = select(state, "six", "toggle");
		state = select(state, "four", "additive-range");

		expectSelection(state, ["two", "six", "four", "five"]);
		expect(state.anchorId).toBe("six");
		expect(state.activeId).toBe("four");
	});

	it("selects every visible ID and clears all selection cursors", () => {
		let state = reduceMediaCollectionSelection(
			createEmptyMediaCollectionSelectionState(),
			{ type: "select-all" },
			visibleIds,
		);
		expectSelection(state, visibleIds);
		expect(state.activeId).toBe("one");

		state = reduceMediaCollectionSelection(
			state,
			{ type: "clear" },
			visibleIds,
		);
		expectSelection(state, []);
		expect(state.activeId).toBeNull();
		expect(state.anchorId).toBeNull();
		expect(state.focusedId).toBeNull();
	});

	it("retains selection cursors when visible IDs are only reordered", () => {
		let state = select(createEmptyMediaCollectionSelectionState(), "one");
		state = select(state, "three", "toggle");
		const reconciled = reduceMediaCollectionSelection(
			state,
			{ type: "reconcile" },
			["three", "two", "one"],
		);

		expect(reconciled).toBe(state);
		expectSelection(reconciled, ["one", "three"]);
		expect(reconciled.activeId).toBe("three");
		expect(reconciled.anchorId).toBe("three");
		expect(reconciled.focusedId).toBe("three");
	});

	it("drops filtered-out IDs and repairs cursors from visible order", () => {
		let state = select(createEmptyMediaCollectionSelectionState(), "one");
		state = select(state, "three", "toggle");
		state = reduceMediaCollectionSelection(state, { type: "reconcile" }, [
			"two",
			"one",
			"four",
		]);

		expectSelection(state, ["one"]);
		expect(state.activeId).toBe("one");
		expect(state.anchorId).toBe("one");
		expect(state.focusedId).toBe("one");
	});

	it("removes a deleted active item and promotes the next visible selection", () => {
		let state = select(createEmptyMediaCollectionSelectionState(), "three");
		state = select(state, "two", "toggle");
		state = reduceMediaCollectionSelection(state, { type: "reconcile" }, [
			"one",
			"three",
			"four",
		]);

		expectSelection(state, ["three"]);
		expect(state.activeId).toBe("three");
		expect(state.anchorId).toBe("three");
		expect(state.focusedId).toBe("three");
	});
});

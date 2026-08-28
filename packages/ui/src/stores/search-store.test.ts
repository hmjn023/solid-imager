import { beforeEach, describe, expect, it } from "vitest";
import {
	activateSimilaritySearch,
	clearSimilaritySearch,
	searchState,
	setSearchState,
} from "./search-store";

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

describe("activateSimilaritySearch", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "sessionStorage", {
			configurable: true,
			value: new MemoryStorage(),
		});
		setSearchState({
			mode: "simple",
			similarityAnchorMediaId: null,
			offset: 0,
			scrollY: 0,
		});
	});

	it("persists v2 activation without writing the legacy state key", () => {
		activateSimilaritySearch("media-v2", { surface: "v2" });

		expect(searchState.mode).toBe("simple");
		expect(searchState.similarityAnchorMediaId).toBe("media-v2");
		expect(
			JSON.parse(sessionStorage.getItem("v2:current-all") ?? "{}"),
		).toEqual({
			value: { type: "group", operator: "and", children: [] },
			selectedSource: "",
			sort: "date",
			order: "desc",
			mode: "simple",
			similarityAnchorMediaId: "media-v2",
			similarityTopK: 50,
		});
		expect(sessionStorage.getItem("current-all")).toBeNull();
	});
});

describe("clearSimilaritySearch", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "sessionStorage", {
			configurable: true,
			value: new MemoryStorage(),
		});
		setSearchState({
			mode: "simple",
			similarityAnchorMediaId: "media-1",
			offset: 10,
			scrollY: 100,
		});
	});

	it("clears both the store and persisted similarity anchor", () => {
		sessionStorage.setItem(
			"current-all",
			JSON.stringify({
				value: { type: "group", operator: "and", children: [] },
				selectedSource: "",
				sort: "date",
				order: "desc",
				mode: "simple",
				similarityAnchorMediaId: "media-1",
				similarityTopK: 50,
			}),
		);

		clearSimilaritySearch();

		expect(searchState.similarityAnchorMediaId).toBeNull();
		expect(searchState.offset).toBe(0);
		expect(searchState.scrollY).toBe(0);
		expect(JSON.parse(sessionStorage.getItem("current-all") ?? "{}")).toEqual({
			value: { type: "group", operator: "and", children: [] },
			selectedSource: "",
			sort: "date",
			order: "desc",
			mode: "simple",
			similarityAnchorMediaId: null,
			similarityTopK: 50,
		});
	});

	it("removes malformed persisted state", () => {
		sessionStorage.setItem("current-all", "not-json");

		clearSimilaritySearch();

		expect(sessionStorage.getItem("current-all")).toContain('"mode":"simple"');
	});

	it("clears the v2 persisted anchor without touching the legacy key", () => {
		sessionStorage.setItem(
			"current-all",
			JSON.stringify({ similarityAnchorMediaId: "legacy-media" }),
		);
		sessionStorage.setItem(
			"v2:current-all",
			JSON.stringify({
				value: { type: "group", operator: "and", children: [] },
				selectedSource: "",
				sort: "date",
				order: "desc",
				mode: "simple",
				similarityAnchorMediaId: "media-v2",
				similarityTopK: 50,
			}),
		);

		clearSimilaritySearch({ surface: "v2" });

		expect(
			JSON.parse(sessionStorage.getItem("v2:current-all") ?? "{}"),
		).toEqual({
			value: { type: "group", operator: "and", children: [] },
			selectedSource: "",
			sort: "date",
			order: "desc",
			mode: "simple",
			similarityAnchorMediaId: null,
			similarityTopK: 50,
		});
		expect(JSON.parse(sessionStorage.getItem("current-all") ?? "{}")).toEqual({
			similarityAnchorMediaId: "legacy-media",
		});
	});
});

describe("clearSimilaritySearch preserves the selected mode", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "sessionStorage", {
			configurable: true,
			value: new MemoryStorage(),
		});
		setSearchState({
			mode: "pro",
			similarityAnchorMediaId: "11111111-1111-4111-8111-111111111111",
			offset: 10,
			scrollY: 100,
		});
	});

	it("clears the anchor without changing the selected mode", () => {
		sessionStorage.setItem(
			"v2:current-all",
			JSON.stringify({
				value: { type: "group", operator: "and", children: [] },
				selectedSource: "",
				sort: "date",
				order: "desc",
				mode: "pro",
				similarityAnchorMediaId: "11111111-1111-4111-8111-111111111111",
				similarityTopK: 50,
			}),
		);

		clearSimilaritySearch({ surface: "v2" });

		expect(searchState.mode).toBe("pro");
		expect(searchState.similarityAnchorMediaId).toBeNull();
		expect(searchState.offset).toBe(0);
		expect(searchState.scrollY).toBe(0);
		expect(
			JSON.parse(sessionStorage.getItem("v2:current-all") ?? "{}"),
		).toEqual({
			value: {
				type: "group",
				operator: "and",
				children: [],
			},
			selectedSource: "",
			sort: "date",
			order: "desc",
			mode: "pro",
			similarityAnchorMediaId: null,
			similarityTopK: 50,
		});
	});
});

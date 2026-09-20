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
			selectedSource: "source-1",
			similarityAnchorMediaId: null,
			offset: 0,
			scrollY: 0,
		});
	});

	it("writes the canonical state and clears the selected source", () => {
		activateSimilaritySearch("media-1");

		expect(searchState.mode).toBe("simple");
		expect(searchState.similarityAnchorMediaId).toBe("media-1");
		expect(searchState.selectedSource).toBe("");
		expect(
			JSON.parse(
				sessionStorage.getItem("solid-imager:search-state:current-all") ?? "{}",
			),
		).toMatchObject({
			selectedSource: "",
			similarityAnchorMediaId: "media-1",
			similarityTopK: 50,
		});
		expect(sessionStorage.getItem("current-all")).toBeNull();
		expect(sessionStorage.getItem("v2:current-all")).toBeNull();
	});
});

describe("clearSimilaritySearch", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "sessionStorage", {
			configurable: true,
			value: new MemoryStorage(),
		});
		setSearchState({
			mode: "pro",
			selectedSource: "source-2",
			similarityAnchorMediaId: "media-1",
			offset: 10,
			scrollY: 100,
		});
	});

	it("clears the anchor and persists canonical state without changing source", () => {
		clearSimilaritySearch();

		expect(searchState.mode).toBe("pro");
		expect(searchState.selectedSource).toBe("source-2");
		expect(searchState.similarityAnchorMediaId).toBeNull();
		expect(searchState.offset).toBe(0);
		expect(searchState.scrollY).toBe(0);
		expect(
			JSON.parse(
				sessionStorage.getItem("solid-imager:search-state:current-all") ?? "{}",
			),
		).toMatchObject({
			selectedSource: "source-2",
			similarityAnchorMediaId: null,
			similarityTopK: 50,
			mode: "pro",
		});
	});

	it("overwrites malformed canonical state safely", () => {
		sessionStorage.setItem("solid-imager:search-state:current-all", "not-json");

		expect(() => clearSimilaritySearch()).not.toThrow();
		expect(
			sessionStorage.getItem("solid-imager:search-state:current-all"),
		).toContain('"mode":"pro"');
	});
});

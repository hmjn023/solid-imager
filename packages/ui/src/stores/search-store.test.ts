import { beforeEach, describe, expect, it } from "vitest";
import {
	activateVectorSearch,
	clearVectorSearchAnchor,
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

describe("activateVectorSearch", () => {
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
		activateVectorSearch("media-v2", { surface: "v2" });

		expect(searchState.mode).toBe("vector");
		expect(searchState.similarityAnchorMediaId).toBe("media-v2");
		expect(
			JSON.parse(sessionStorage.getItem("v2:current-all") ?? "{}"),
		).toEqual({
			mode: "vector",
			similarityAnchorMediaId: "media-v2",
			similarityTopK: 50,
		});
		expect(sessionStorage.getItem("current-all")).toBeNull();
	});
});

describe("clearVectorSearchAnchor", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "sessionStorage", {
			configurable: true,
			value: new MemoryStorage(),
		});
		setSearchState({
			mode: "vector",
			similarityAnchorMediaId: "media-1",
			offset: 10,
			scrollY: 100,
		});
	});

	it("clears both the store and persisted vector anchor", () => {
		sessionStorage.setItem(
			"current-all",
			JSON.stringify({
				mode: "vector",
				similarityAnchorMediaId: "media-1",
				similarityTopK: 50,
			}),
		);

		clearVectorSearchAnchor();

		expect(searchState.similarityAnchorMediaId).toBeNull();
		expect(searchState.offset).toBe(0);
		expect(searchState.scrollY).toBe(0);
		expect(JSON.parse(sessionStorage.getItem("current-all") ?? "{}")).toEqual({
			mode: "vector",
			similarityAnchorMediaId: null,
			similarityTopK: 50,
		});
	});

	it("removes malformed persisted state", () => {
		sessionStorage.setItem("current-all", "not-json");

		clearVectorSearchAnchor();

		expect(sessionStorage.getItem("current-all")).toBeNull();
	});

	it("clears the v2 persisted anchor without touching the legacy key", () => {
		sessionStorage.setItem(
			"current-all",
			JSON.stringify({ similarityAnchorMediaId: "legacy-media" }),
		);
		sessionStorage.setItem(
			"v2:current-all",
			JSON.stringify({
				mode: "vector",
				similarityAnchorMediaId: "media-v2",
				similarityTopK: 50,
			}),
		);

		clearVectorSearchAnchor({ surface: "v2" });

		expect(
			JSON.parse(sessionStorage.getItem("v2:current-all") ?? "{}"),
		).toEqual({
			mode: "vector",
			similarityAnchorMediaId: null,
			similarityTopK: 50,
		});
		expect(JSON.parse(sessionStorage.getItem("current-all") ?? "{}")).toEqual({
			similarityAnchorMediaId: "legacy-media",
		});
	});
});

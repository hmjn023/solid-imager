import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
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
});

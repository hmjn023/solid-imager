import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	clearMediaReturnPath,
	findMediaNeighbors,
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
});

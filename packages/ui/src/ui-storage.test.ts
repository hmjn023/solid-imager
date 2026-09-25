import { describe, expect, it } from "vitest";
import {
	getSearchScrollStorageKey,
	getSearchStateStorageKey,
	readSearchScrollStorageValue,
	readSearchStateStorageValue,
	readUiStorageValue,
	UI_STORAGE_KEYS,
} from "./ui-storage";

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

describe("ui storage keys", () => {
	it("exposes the shared canonical UI keys", () => {
		expect(UI_STORAGE_KEYS).toEqual({
			sidebarExpanded: "solid-imager:sidebar-expanded",
			searchViewMode: "solid-imager:search:view-mode",
			sourceViewMode: "solid-imager:source-media:view-mode",
			mediaContext: "solid-imager:media-context",
			mediaReturn: "solid-imager:media-return",
		});
	});

	it("reads values from the canonical UI keys", () => {
		const storage = new MemoryStorage();
		storage.setItem(UI_STORAGE_KEYS.sidebarExpanded, "false");
		storage.setItem(UI_STORAGE_KEYS.searchViewMode, "grid");
		storage.setItem(UI_STORAGE_KEYS.sourceViewMode, "list");
		storage.setItem(UI_STORAGE_KEYS.mediaContext, '{"sourceId":"source-1"}');
		storage.setItem(UI_STORAGE_KEYS.mediaReturn, "/search");

		expect(readUiStorageValue(storage, UI_STORAGE_KEYS.sidebarExpanded)).toBe(
			"false",
		);
		expect(readUiStorageValue(storage, UI_STORAGE_KEYS.searchViewMode)).toBe(
			"grid",
		);
		expect(readUiStorageValue(storage, UI_STORAGE_KEYS.sourceViewMode)).toBe(
			"list",
		);
		expect(readUiStorageValue(storage, UI_STORAGE_KEYS.mediaContext)).toBe(
			'{"sourceId":"source-1"}',
		);
		expect(readUiStorageValue(storage, UI_STORAGE_KEYS.mediaReturn)).toBe(
			"/search",
		);

		expect(storage.getItem(UI_STORAGE_KEYS.sidebarExpanded)).toBe("false");
	});
});

describe("search storage keys", () => {
	it("reads state from its source-scoped canonical path", () => {
		const storage = new MemoryStorage();
		storage.setItem(getSearchStateStorageKey("current-all"), "web-state");
		storage.setItem(
			getSearchStateStorageKey("current-source-1"),
			"source-state",
		);

		expect(readSearchStateStorageValue(storage, "current-all")).toBe(
			"web-state",
		);
		expect(readSearchStateStorageValue(storage, "current-source-1")).toBe(
			"tauri-state",
		);
		expect(storage.getItem(getSearchStateStorageKey("current-all"))).toBe(
			"web-state",
		);
		expect(storage.getItem(getSearchStateStorageKey("current-source-1"))).toBe(
			"tauri-state",
		);
	});

	it("reads source and history scroll entries independently", () => {
		const storage = new MemoryStorage();
		storage.setItem(getSearchScrollStorageKey("current-all"), "100");
		storage.setItem(getSearchScrollStorageKey("current-source-1"), "200");
		storage.setItem(getSearchScrollStorageKey("current-all", "entry-1"), "300");

		expect(readSearchScrollStorageValue(storage, "current-all")).toBe("100");
		expect(readSearchScrollStorageValue(storage, "current-source-1")).toBe(
			"200",
		);
		expect(
			readSearchScrollStorageValue(storage, "current-all", "entry-1"),
		).toBe("300");
		expect(storage.getItem(getSearchScrollStorageKey("current-all"))).toBe(
			"100",
		);
		expect(storage.getItem(getSearchScrollStorageKey("current-source-1"))).toBe(
			"200",
		);
		expect(
			storage.getItem(getSearchScrollStorageKey("current-all", "entry-1")),
		).toBe("300");
	});
});

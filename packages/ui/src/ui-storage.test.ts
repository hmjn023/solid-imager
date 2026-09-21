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

class FailingMigrationStorage extends MemoryStorage {
	private failWrites = false;

	setItem(key: string, value: string): void {
		if (this.failWrites && key.startsWith("solid-imager:")) {
			throw new DOMException("storage is full", "QuotaExceededError");
		}
		super.setItem(key, value);
	}

	startFailingWrites(): void {
		this.failWrites = true;
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

	it("migrates each former UI key and removes it after a verified copy", () => {
		const storage = new MemoryStorage();
		storage.setItem("solid-imager:v2-sidebar-expanded", "false");
		storage.setItem("solid-imager:v2:search:view-mode", "grid");
		storage.setItem("solid-imager:v2:source-media:view-mode", "list");
		storage.setItem("v2:media-context", '{"sourceId":"source-1"}');
		storage.setItem("v2:media-return", "/search");

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
		expect(storage.getItem("solid-imager:v2-sidebar-expanded")).toBeNull();
		expect(storage.getItem(UI_STORAGE_KEYS.mediaReturn)).toBe("/search");
		expect(storage.getItem("v2:media-return")).toBeNull();
	});

	it("prefers a canonical UI value and leaves stale legacy data alone", () => {
		const storage = new MemoryStorage();
		storage.setItem(UI_STORAGE_KEYS.searchViewMode, "list");
		storage.setItem("solid-imager:v2:search:view-mode", "grid");

		expect(readUiStorageValue(storage, UI_STORAGE_KEYS.searchViewMode)).toBe(
			"list",
		);
		expect(storage.getItem("solid-imager:v2:search:view-mode")).toBe("grid");
	});

	it("keeps old UI data when canonical storage cannot be written", () => {
		const storage = new FailingMigrationStorage();
		storage.setItem("solid-imager:v2:search:view-mode", "grid");
		storage.startFailingWrites();

		expect(readUiStorageValue(storage, UI_STORAGE_KEYS.searchViewMode)).toBe(
			"grid",
		);
		expect(storage.getItem(UI_STORAGE_KEYS.searchViewMode)).toBeNull();
		expect(storage.getItem("solid-imager:v2:search:view-mode")).toBe("grid");
	});
});

describe("search storage keys", () => {
	it("migrates Web and Tauri state into one source-scoped canonical path", () => {
		const storage = new MemoryStorage();
		storage.setItem("v2:current-all", "web-state");
		storage.setItem("current-source-1", "tauri-state");

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
		expect(storage.getItem("v2:current-all")).toBeNull();
		expect(storage.getItem("current-source-1")).toBeNull();
	});

	it("uses canonical state when both canonical and former values exist", () => {
		const storage = new MemoryStorage();
		storage.setItem(getSearchStateStorageKey("current-all"), "canonical");
		storage.setItem("v2:current-all", "web-stale");
		storage.setItem("current-all", "tauri-stale");

		expect(readSearchStateStorageValue(storage, "current-all")).toBe(
			"canonical",
		);
	});

	it("keeps source and history scroll entries independent", () => {
		const storage = new MemoryStorage();
		storage.setItem("search-scroll:v2:current-all", "100");
		storage.setItem("search-scroll:legacy:current-source-1", "200");
		storage.setItem("search-scroll:v2:history:entry-1", "300");

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
		expect(storage.getItem("search-scroll:v2:current-all")).toBeNull();
		expect(storage.getItem("search-scroll:legacy:current-source-1")).toBeNull();
		expect(storage.getItem("search-scroll:v2:history:entry-1")).toBeNull();
	});

	it("prefers canonical scroll and does not resurrect stale legacy state", () => {
		const storage = new MemoryStorage();
		storage.setItem(getSearchScrollStorageKey("current-all"), "400");
		storage.setItem("search-scroll:v2:current-all", "100");
		storage.setItem("search-scroll:legacy:current-all", "200");

		expect(readSearchScrollStorageValue(storage, "current-all")).toBe("400");
		expect(storage.getItem("search-scroll:v2:current-all")).toBe("100");
		expect(storage.getItem("search-scroll:legacy:current-all")).toBe("200");
	});

	it("keeps old search data when migration storage is unavailable", () => {
		const storage = new FailingMigrationStorage();
		storage.setItem("current-all", "tauri-state");
		storage.setItem("search-scroll:legacy:current-all", "120");
		storage.startFailingWrites();

		expect(readSearchStateStorageValue(storage, "current-all")).toBe(
			"tauri-state",
		);
		expect(readSearchScrollStorageValue(storage, "current-all")).toBe("120");
		expect(storage.getItem("current-all")).toBe("tauri-state");
		expect(storage.getItem("search-scroll:legacy:current-all")).toBe("120");
	});
});

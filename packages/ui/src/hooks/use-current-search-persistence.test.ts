import { type Accessor, createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	activateSimilaritySearch,
	resetSearchState,
	searchState,
	setSearchState,
} from "../stores/search-store";
import {
	persistSearchScrollPosition,
	type SearchPersistenceOptions,
	type SearchPersistenceSource,
	useCurrentSearchPersistence,
} from "./use-current-search-persistence";

vi.mock("solid-js", async () =>
	vi.importActual<typeof import("solid-js")>("solid-js/dist/solid.js"),
);
vi.mock("solid-js/store", async () =>
	vi.importActual<typeof import("solid-js/store")>(
		"solid-js/store/dist/store.js",
	),
);
vi.mock("solid-js/web", async () => ({
	...(await vi.importActual<typeof import("solid-js/web")>(
		"solid-js/web/dist/web.js",
	)),
	isServer: false,
}));

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

class FailingStorage extends MemoryStorage {
	private shouldFail = false;

	setItem(key: string, value: string): void {
		if (this.shouldFail) {
			throw new DOMException("storage is full", "QuotaExceededError");
		}
		super.setItem(key, value);
	}

	startFailingWrites(): void {
		this.shouldFail = true;
	}
}

interface MountedPersistence {
	readonly dispose: () => void;
	readonly initialValue: boolean;
	readonly isRestored: Accessor<boolean>;
}

const createPersistedSimpleState = (
	searchQuery: string,
	selectedSource = "",
) => ({
	mode: "simple",
	selectedSource,
	value: {
		type: "group",
		operator: "and",
		children: [
			{
				type: "criterion",
				target: "keyword",
				operator: "contains",
				value: searchQuery,
			},
		],
	},
	sort: "date",
	order: "desc",
});

const flushMicrotasks = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe("useCurrentSearchPersistence", () => {
	const mountedRoots: MountedPersistence[] = [];

	const mountPersistence = (
		sourceId: SearchPersistenceSource,
		options?: SearchPersistenceOptions,
	): MountedPersistence => {
		const mounted = createRoot((dispose) => {
			const isRestored = useCurrentSearchPersistence(sourceId, options);
			return { dispose, initialValue: isRestored(), isRestored };
		});
		mountedRoots.push(mounted);
		return mounted;
	};

	beforeEach(() => {
		Object.defineProperty(globalThis, "sessionStorage", {
			configurable: true,
			value: new MemoryStorage(),
		});
		resetSearchState();
	});

	afterEach(() => {
		for (const mounted of mountedRoots.splice(0)) {
			mounted.dispose();
		}
		vi.useRealTimers();
	});

	it("gates queries until local session state is restored", async () => {
		sessionStorage.setItem(
			"solid-imager:search-state:current-all",
			JSON.stringify(createPersistedSimpleState("restored query", "source-1")),
		);

		const mounted = mountPersistence("all");
		expect(mounted.initialValue).toBe(false);
		await flushMicrotasks();

		expect(mounted.isRestored()).toBe(true);
		expect(searchState.searchQuery).toBe("restored query");
		expect(searchState.selectedSource).toBe("source-1");
		expect(
			JSON.parse(
				sessionStorage.getItem("solid-imager:search-state:current-all") ?? "{}",
			),
		).toMatchObject({
			selectedSource: "source-1",
			value: expect.objectContaining({
				children: expect.arrayContaining([
					expect.objectContaining({ value: "restored query" }),
				]),
			}),
		});
	});

	it("persists the initial state before the debounce expires", async () => {
		mountPersistence("all");
		await flushMicrotasks();

		expect(
			sessionStorage.getItem("solid-imager:search-state:current-all"),
		).toContain('"mode":"simple"');
	});

	it("restores the latest source when the source accessor changes", async () => {
		const [sourceId, setSourceId] = createSignal("source-a");
		sessionStorage.setItem(
			"solid-imager:search-state:current-source-a",
			JSON.stringify(createPersistedSimpleState("source A")),
		);
		sessionStorage.setItem(
			"solid-imager:search-state:current-source-b",
			JSON.stringify(createPersistedSimpleState("source B")),
		);
		const mounted = mountPersistence(sourceId);
		await flushMicrotasks();
		expect(searchState.searchQuery).toBe("source A");

		setSourceId("source-b");
		await flushMicrotasks();

		expect(mounted.isRestored()).toBe(true);
		expect(searchState.searchQuery).toBe("source B");
	});

	it("resets to defaults for malformed session JSON", async () => {
		setSearchState({
			mode: "pro",
			searchQuery: "previous route",
			selectedTags: ["stale-tag"],
			sortBy: "name",
			sortOrder: "asc",
		});
		sessionStorage.setItem("solid-imager:search-state:current-all", "not-json");

		const mounted = mountPersistence("all");
		await flushMicrotasks();

		expect(mounted.isRestored()).toBe(true);
		expect(searchState.mode).toBe("simple");
		expect(searchState.searchQuery).toBe("");
		expect(searchState.selectedTags).toEqual([]);
		expect(searchState.sortBy).toBe("date");
		expect(searchState.sortOrder).toBe("desc");
	});

	it("restores selectedSource from the session payload", async () => {
		sessionStorage.setItem(
			"solid-imager:search-state:current-all",
			JSON.stringify(createPersistedSimpleState("saved query", "saved-source")),
		);

		mountPersistence("all");
		await flushMicrotasks();

		expect(searchState.searchQuery).toBe("saved query");
		expect(searchState.selectedSource).toBe("saved-source");
	});

	it("preserves the current scroll position while restoring search state", async () => {
		sessionStorage.setItem("solid-imager:search-scroll:current-all", "1840");
		sessionStorage.setItem(
			"solid-imager:search-state:current-all",
			JSON.stringify(createPersistedSimpleState("saved query")),
		);

		mountPersistence("all");
		await flushMicrotasks();

		expect(searchState.scrollY).toBe(1840);
		expect(
			sessionStorage.getItem("solid-imager:search-scroll:current-all"),
		).toBe("1840");
	});

	it("restores a history entry scroll key independently", async () => {
		sessionStorage.setItem("solid-imager:search-scroll:history:entry-1", "920");
		sessionStorage.setItem(
			"solid-imager:search-state:current-all",
			JSON.stringify(createPersistedSimpleState("saved query")),
		);

		mountPersistence("all", { historyEntryKey: "entry-1" });
		await flushMicrotasks();

		expect(searchState.scrollY).toBe(920);
		expect(
			sessionStorage.getItem("solid-imager:search-scroll:history:entry-1"),
		).toBe("920");
	});

	it("restores canonical search and scroll values", async () => {
		vi.useFakeTimers();
		sessionStorage.setItem(
			"solid-imager:search-state:current-all",
			JSON.stringify(createPersistedSimpleState("shared query")),
		);
		sessionStorage.setItem("solid-imager:search-scroll:current-all", "1840");

		mountPersistence("all");
		await flushMicrotasks();

		expect(searchState.searchQuery).toBe("shared query");
		expect(searchState.scrollY).toBe(1840);
		expect(
			sessionStorage.getItem("solid-imager:search-state:current-all"),
		).toContain("shared query");
		expect(
			sessionStorage.getItem("solid-imager:search-scroll:current-all"),
		).toBe("1840");
		setSearchState("scrollY", 2200);
		expect(searchState.scrollY).toBe(2200);
		persistSearchScrollPosition("all", searchState.scrollY);
		await flushMicrotasks();
		await vi.advanceTimersByTimeAsync(1000);

		expect(
			sessionStorage.getItem("solid-imager:search-scroll:current-all"),
		).toBe("2200");
	});

	it("restores similarity ordering activated from the detail route", async () => {
		setSearchState("selectedSource", "source-1");
		activateSimilaritySearch("media-1");

		const mounted = mountPersistence("all");
		await flushMicrotasks();

		expect(mounted.isRestored()).toBe(true);
		expect(searchState.mode).toBe("simple");
		expect(searchState.similarityAnchorMediaId).toBe("media-1");
		expect(searchState.selectedSource).toBe("");
		expect(
			sessionStorage.getItem("solid-imager:search-state:current-all"),
		).toContain("media-1");
	});

	it("restores similarity ordering from canonical session state", async () => {
		sessionStorage.setItem(
			"solid-imager:search-state:current-all",
			JSON.stringify({
				mode: "simple",
				value: { type: "group", operator: "and", children: [] },
				sort: "date",
				order: "desc",
				similarityAnchorMediaId: "11111111-1111-4111-8111-111111111111",
				similarityTopK: 100,
			}),
		);

		mountPersistence("all");
		await flushMicrotasks();

		expect(searchState.mode).toBe("simple");
		expect(searchState.similarityTopK).toBe(100);
	});

	it("restores canonical state when persistence writes fail", async () => {
		const storage = new FailingStorage();
		storage.setItem(
			"solid-imager:search-state:current-all",
			JSON.stringify(createPersistedSimpleState("stored query")),
		);
		storage.startFailingWrites();
		Object.defineProperty(globalThis, "sessionStorage", {
			configurable: true,
			value: storage,
		});

		const mounted = mountPersistence("all");
		await flushMicrotasks();

		expect(mounted.isRestored()).toBe(true);
		expect(searchState.searchQuery).toBe("stored query");
		expect(storage.getItem("solid-imager:search-state:current-all")).toContain(
			"stored query",
		);
	});

	it("does not save a pending source state under the next source key", async () => {
		vi.useFakeTimers();
		const [sourceId, setSourceId] = createSignal("source-a");
		sessionStorage.setItem(
			"solid-imager:search-state:current-source-a",
			JSON.stringify(createPersistedSimpleState("initial A")),
		);
		const mounted = mountPersistence(sourceId);
		await flushMicrotasks();
		expect(mounted.isRestored()).toBe(true);

		setSearchState("searchQuery", "pending A");
		setSourceId("source-b");
		await flushMicrotasks();
		expect(searchState.searchQuery).toBe("");

		await vi.advanceTimersByTimeAsync(1000);

		const persistedForB = JSON.parse(
			sessionStorage.getItem("solid-imager:search-state:current-source-b") ??
				"{}",
		);
		expect(persistedForB.value?.children).toEqual([]);
		expect(persistedForB.selectedSource).toBe("");
		expect(JSON.stringify(persistedForB)).not.toContain("pending A");
	});

	it("cancels a pending save when its owner is disposed", async () => {
		vi.useFakeTimers();
		sessionStorage.setItem(
			"solid-imager:search-state:current-all",
			JSON.stringify(createPersistedSimpleState("initial")),
		);
		const mounted = mountPersistence("all");
		await flushMicrotasks();

		setSearchState("searchQuery", "pending after unmount");
		mounted.dispose();
		await vi.advanceTimersByTimeAsync(1000);

		expect(
			sessionStorage.getItem("solid-imager:search-state:current-all"),
		).not.toContain("pending after unmount");
	});
});

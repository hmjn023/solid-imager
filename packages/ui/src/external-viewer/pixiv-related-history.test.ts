import { afterEach, expect, it, vi } from "vitest";
import {
	clearPixivRelatedSnapshots,
	readPixivRelatedSnapshot,
	writePixivRelatedSnapshot,
} from "./pixiv-related-history";

afterEach(() => vi.unstubAllGlobals());

it("restores JSON page cursors, separates accounts and clears only related snapshots", () => {
	const values = new Map<string, string>();
	const storage: Storage = {
		get length() {
			return values.size;
		},
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => {
			values.set(key, value);
		},
		removeItem: (key) => {
			values.delete(key);
		},
		clear: () => values.clear(),
		key: (index) => [...values.keys()][index] ?? null,
	};
	vi.stubGlobal("sessionStorage", storage);
	const snapshot = {
		data: {
			pages: [
				{ posts: [], nextIds: Array.from({ length: 30 }, (_, i) => i + 1) },
				{ posts: [], nextIds: [] },
			],
			pageParams: [undefined, Array.from({ length: 30 }, (_, i) => i + 1)],
		},
		scrollTop: 1350,
	};
	writePixivRelatedSnapshot("account-a", snapshot);
	expect(readPixivRelatedSnapshot("account-a")).toEqual(snapshot);
	expect(readPixivRelatedSnapshot("account-b")).toBeUndefined();
	storage.setItem("preference", "keep");
	const savedKey = storage.key(0);
	if (!savedKey) throw new Error("Missing snapshot");
	storage.setItem(
		savedKey,
		JSON.stringify({ ...snapshot, data: { pages: [], pageParams: [null] } }),
	);
	expect(readPixivRelatedSnapshot("account-a")).toBeUndefined();
	clearPixivRelatedSnapshots();
	expect(values).toEqual(new Map([["preference", "keep"]]));
});

it("continues when browser storage is blocked", () => {
	vi.stubGlobal("sessionStorage", {
		getItem: () => {
			throw new Error("Blocked");
		},
		setItem: () => {
			throw new Error("Blocked");
		},
	});
	expect(readPixivRelatedSnapshot("work")).toBeUndefined();
	expect(() =>
		writePixivRelatedSnapshot("work", {
			data: { pages: [{ posts: [], nextIds: [] }], pageParams: [undefined] },
			scrollTop: 0,
		}),
	).not.toThrow();
});

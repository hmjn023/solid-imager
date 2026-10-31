import { describe, expect, it } from "vitest";
import { UI_STORAGE_KEYS } from "../ui-storage";
import {
	readManagerBatchRun,
	saveManagerBatchRun,
	type ManagerBatchRun,
} from "./manager-batch-run";

function memoryStorage(): Storage {
	const values = new Map<string, string>();
	return {
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
}

describe("Manager batch recovery", () => {
	it.each(["tagging", "vectors", "thumbnails"] as const)(
		"restores job identity and options for %s",
		(tab) => {
			const storage = memoryStorage();
			const run: ManagerBatchRun = {
				jobId: "11111111-1111-4111-8111-111111111111",
				tab,
				vectorModel: "embeddinggemma2",
				force: true,
				mediaSourceId: "22222222-2222-4222-8222-222222222222",
			};
			saveManagerBatchRun(storage, run);
			expect(readManagerBatchRun(storage)).toEqual(run);
		},
	);
	it.each(["{", JSON.stringify({ jobId: "invalid", tab: "vectors" })])(
		"discards corrupt saved state",
		(value) => {
			const storage = memoryStorage();
			storage.setItem(UI_STORAGE_KEYS.managerBatchRun, value);
			expect(readManagerBatchRun(storage)).toBeNull();
			expect(storage.getItem(UI_STORAGE_KEYS.managerBatchRun)).toBeNull();
		},
	);
	it("tolerates blocked storage", () => {
		const storage = memoryStorage();
		storage.getItem = () => {
			throw new Error("blocked");
		};
		storage.setItem = () => {
			throw new Error("blocked");
		};
		expect(readManagerBatchRun(storage)).toBeNull();
		expect(() =>
			saveManagerBatchRun(storage, {
				jobId: "11111111-1111-4111-8111-111111111111",
				tab: "vectors",
				vectorModel: "ccip",
				force: false,
			}),
		).not.toThrow();
	});
});

import { describe, expect, it, vi } from "vitest";
import { createRelatedMediaSeedStore } from "./related-media-seeds";
import { UI_STORAGE_KEYS } from "./ui-storage";

const sourceId = "11111111-1111-4111-8111-111111111111";
const mediaId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";

function storage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
	};
}

describe("related media seed persistence", () => {
	it("restores the selected seed after another image and after a reload", () => {
		const session = storage();
		const createSeed = vi
			.fn()
			.mockReturnValueOnce("first")
			.mockReturnValueOnce("other");
		const store = createRelatedMediaSeedStore(session, createSeed);
		expect(store.get(sourceId, mediaId)).toBe("first");
		expect(store.get(sourceId, otherId)).toBe("other");
		expect(store.get(sourceId, mediaId)).toBe("first");
		store.save(sourceId, mediaId, "refreshed");
		expect(createRelatedMediaSeedStore(session).get(sourceId, mediaId)).toBe(
			"refreshed",
		);
		expect(createSeed).toHaveBeenCalledTimes(2);
	});

	it("isolates source/media identities", () => {
		const store = createRelatedMediaSeedStore(undefined, () => "initial");
		store.save(sourceId, mediaId, "source-a");
		store.save(otherId, mediaId, "source-b");
		expect(store.get(sourceId, mediaId)).toBe("source-a");
		expect(store.get(otherId, mediaId)).toBe("source-b");
	});

	it.each(["not-json", JSON.stringify([{ sourceId, mediaId, seed: "" }])])(
		"recovers from invalid persisted values: %s",
		(value) => {
			const session = storage();
			session.setItem(UI_STORAGE_KEYS.relatedMediaSeeds, value);
			expect(
				createRelatedMediaSeedStore(session, () => "recovered").get(
					sourceId,
					mediaId,
				),
			).toBe("recovered");
		},
	);

	it("keeps seeds in memory when reads and writes are blocked", () => {
		const blocked = {
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("quota");
			},
		};
		const store = createRelatedMediaSeedStore(blocked, () => "initial");
		expect(store.get(sourceId, mediaId)).toBe("initial");
		store.save(sourceId, mediaId, "refreshed");
		expect(store.get(sourceId, mediaId)).toBe("refreshed");
	});

	it("bounds saved seeds while retaining recently visited images", () => {
		const session = storage();
		const store = createRelatedMediaSeedStore(session, () => "new");
		store.save(sourceId, mediaId, "keep");
		for (let index = 0; index < 100; index += 1) {
			store.save(
				sourceId,
				`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
				String(index),
			);
			if (index === 50) store.get(sourceId, mediaId);
		}
		const saved = JSON.parse(
			session.getItem(UI_STORAGE_KEYS.relatedMediaSeeds) ?? "[]",
		);
		expect(saved).toHaveLength(100);
		expect(createRelatedMediaSeedStore(session).get(sourceId, mediaId)).toBe(
			"keep",
		);
	});
});

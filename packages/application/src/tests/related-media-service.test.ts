import { describe, expect, it, vi } from "vitest";
import { ResourceNotFoundError } from "@solid-imager/core/errors";
import type { Media, MediaRelatedReader } from "@solid-imager/core/media";
import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
} from "@solid-imager/core/search";
import type {
	RelatedEmbeddingReader,
	ImageEmbedding,
} from "../ports/embedding-store";
import { RelatedMediaService } from "../services/related-media-service";

const sourceId = "11111111-1111-4111-8111-111111111111";
const otherSourceId = "22222222-2222-4222-8222-222222222222";
const mediaId = "33333333-3333-4333-8333-333333333333";
const modifiedAt = new Date("2026-10-01T00:00:00Z");

function media(id = mediaId, changes: Partial<Media> = {}): Media {
	return {
		id,
		mediaSourceId: sourceId,
		filePath: `private/${id}.png`,
		fileName: `${id}.png`,
		mediaType: "image",
		width: 100,
		height: 100,
		fileSize: 100,
		description: null,
		createdAt: modifiedAt,
		modifiedAt,
		indexedAt: modifiedAt,
		status: "active",
		...changes,
	};
}

function setup() {
	const repository = {
		findById: vi.fn<() => Promise<Media | null>>().mockResolvedValue(media()),
		findByIds: vi
			.fn<(ids: string[]) => Promise<Media[]>>()
			.mockResolvedValue([]),
		findRelatedByTags: vi
			.fn<MediaRelatedReader["findRelatedByTags"]>()
			.mockResolvedValue([]),
		getRelatedMediaSignals: vi
			.fn<MediaRelatedReader["getRelatedMediaSignals"]>()
			.mockResolvedValue([]),
		findRelatedByRelation: vi
			.fn<
				(
					id: string,
					relation: "character" | "ip",
					limit: number,
					seed?: string,
				) => Promise<Media[]>
			>()
			.mockResolvedValue([]),
	};
	const embedding: ImageEmbedding = {
		mediaId,
		vector: [1, 0],
		model: EMBEDDING_GEMMA_MODEL,
		version: EMBEDDING_GEMMA_VERSION,
		mediaModifiedAt: modifiedAt,
	};
	const store = {
		get: vi.fn<RelatedEmbeddingReader["get"]>().mockResolvedValue(embedding),
		nearestRelated: vi
			.fn<RelatedEmbeddingReader["nearestRelated"]>()
			.mockResolvedValue([]),
	};
	const logger = { warn: vi.fn() };
	return {
		repository,
		store,
		embedding,
		logger,
		service: new RelatedMediaService({
			mediaRepository: repository,
			embeddingStore: store,
			logger,
		}),
	};
}

describe("RelatedMediaService", () => {
	it("interleaves categories, preserves similarity ranking, merges reasons and returns safe fields", async () => {
		const { repository, store, service } = setup();
		const first = media("44444444-4444-4444-8444-444444444444");
		const second = media("55555555-5555-4555-8555-555555555555");
		const character = media("66666666-6666-4666-8666-666666666666", {
			mediaSourceId: otherSourceId,
		});
		const ip = media("77777777-7777-4777-8777-777777777777");
		store.nearestRelated.mockResolvedValue([
			{ mediaId: first.id, cosineDistance: 0.1 },
			{ mediaId: second.id, cosineDistance: 0.2 },
		]);
		repository.findByIds.mockResolvedValue([second, first]);
		repository.findRelatedByRelation.mockImplementation(
			async (_id, relation) =>
				relation === "character" ? [character, first] : [ip, first],
		);

		const result = await service.getRelated({ sourceId, mediaId, limit: 2 });

		expect(result.similarityStatus).toBe("available");
		expect(result.items.map((item) => item.media.id)).toEqual([
			first.id,
			character.id,
			ip.id,
			second.id,
		]);
		expect(result.items[0].reasons).toEqual(["similar", "character", "ip"]);
		expect(result.items[1].media.mediaSourceId).toBe(otherSourceId);
		expect(result.items.every((item) => !("filePath" in item.media))).toBe(
			true,
		);
		expect(result.recommendations).toHaveLength(2);
		expect(
			result.recommendations.every((item) => !("filePath" in item.media)),
		).toBe(true);
		expect(store.nearestRelated).toHaveBeenCalledWith([1, 0], mediaId, 96);
	});

	it("does not promote a lower-ranked visual match ahead of better visual matches through metadata", async () => {
		const { repository, store, service } = setup();
		const candidates = [
			media("44444444-4444-4444-8444-444444444444"),
			media("55555555-5555-4555-8555-555555555555"),
			media("66666666-6666-4666-8666-666666666666"),
		];
		store.nearestRelated.mockResolvedValue(
			candidates.map((item, index) => ({
				mediaId: item.id,
				cosineDistance: index / 10,
			})),
		);
		repository.findByIds.mockResolvedValue(candidates);
		repository.findRelatedByRelation.mockResolvedValue([candidates[2]]);
		const result = await service.getRelated({ sourceId, mediaId });
		expect(
			result.items
				.filter((item) => item.reasons.includes("similar"))
				.map((item) => item.media.id),
		).toEqual(candidates.map((item) => item.id));
		expect(result.items[2].reasons).toEqual(["similar", "character", "ip"]);
	});

	it.each(["missing", "stale", "model", "version"])(
		"keeps character/IP recommendations when the anchor embedding is %s",
		async (condition) => {
			const { repository, store, embedding, service } = setup();
			const candidate = media("44444444-4444-4444-8444-444444444444");
			repository.findRelatedByRelation.mockResolvedValue([candidate]);
			store.get.mockResolvedValue(
				condition === "missing"
					? null
					: {
							...embedding,
							...(condition === "stale"
								? { mediaModifiedAt: new Date(0) }
								: {}),
							...(condition === "model" ? { model: "other-model" } : {}),
							...(condition === "version"
								? { version: EMBEDDING_GEMMA_VERSION + 1 }
								: {}),
						},
			);

			const result = await service.getRelated({ sourceId, mediaId });

			expect(result.similarityStatus).toBe("not_indexed");
			expect(result.items).toHaveLength(1);
			expect(result.items[0].reasons).toEqual(["character", "ip"]);
			expect(store.nearestRelated).not.toHaveBeenCalled();
			expect(repository.findRelatedByRelation).toHaveBeenCalledWith(
				mediaId,
				"character",
				96,
				"default",
			);
		},
	);

	it("isolates an unavailable vector search from metadata recommendations", async () => {
		const { repository, store, service, logger } = setup();
		store.nearestRelated.mockRejectedValue(
			new Error("vector store unavailable"),
		);
		repository.findRelatedByRelation.mockResolvedValue([
			media("44444444-4444-4444-8444-444444444444"),
		]);

		const result = await service.getRelated({ sourceId, mediaId });

		expect(result.similarityStatus).toBe("unavailable");
		expect(result.items).toHaveLength(1);
		expect(logger.warn).toHaveBeenCalledOnce();
	});

	it.each([
		null,
		media(mediaId, { mediaSourceId: otherSourceId }),
		media(mediaId, { status: "archived" }),
		media(mediaId, { status: "deleted" }),
	])(
		"checks anchor existence, active status and source before any recommendations",
		async (anchor) => {
			const { repository, store, service } = setup();
			repository.findById.mockResolvedValue(anchor);

			await expect(
				service.getRelated({ sourceId, mediaId }),
			).rejects.toBeInstanceOf(ResourceNotFoundError);
			expect(repository.findRelatedByRelation).not.toHaveBeenCalled();
			expect(store.get).not.toHaveBeenCalled();
		},
	);

	it("returns only active images, excluding the anchor, even if candidates change during retrieval", async () => {
		const { repository, service } = setup();
		repository.findRelatedByRelation.mockResolvedValue([
			media(),
			media("44444444-4444-4444-8444-444444444444", { status: "archived" }),
			media("55555555-5555-4555-8555-555555555555", { status: "deleted" }),
			media("66666666-6666-4666-8666-666666666666", { mediaType: "video" }),
		]);
		expect((await service.getRelated({ sourceId, mediaId })).items).toEqual([]);
	});

	it("skips embedding reads for audio anchors and handles empty relations", async () => {
		const { repository, store, service } = setup();
		repository.findById.mockResolvedValue(
			media(mediaId, { mediaType: "audio" }),
		);
		expect(await service.getRelated({ sourceId, mediaId })).toEqual({
			items: [],
			recommendations: [],
			similarityStatus: "not_indexed",
		});
		expect(store.get).not.toHaveBeenCalled();
	});

	it.each([0, -1, 25, 1.5])(
		"rejects invalid per-category limit %s before reading media",
		async (limit) => {
			const { repository, service } = setup();
			await expect(
				service.getRelated({ sourceId, mediaId, limit }),
			).rejects.toThrow();
			expect(repository.findById).not.toHaveBeenCalled();
		},
	);

	it("uses positive tag matches without an image index or character/IP links", async () => {
		const { repository, store, service } = setup();
		const candidate = media("44444444-4444-4444-8444-444444444444");
		store.get.mockResolvedValue(null);
		repository.findRelatedByTags.mockResolvedValue([
			{ media: candidate, score: 0.75 },
		]);
		const result = await service.getRelated({ sourceId, mediaId });
		expect(result.similarityStatus).toBe("not_indexed");
		expect(result.recommendations.map((item) => item.media.id)).toEqual([
			candidate.id,
		]);
		expect(result.recommendations[0].reasons).toEqual(["tag"]);
		expect(result.items).toEqual(result.recommendations);
	});

	it("repeats a seed exactly and changes selected members, not only their order, on refresh", async () => {
		const { repository, service } = setup();
		const pool = Array.from({ length: 40 }, (_, index) =>
			media(`candidate-${index}`),
		);
		repository.findRelatedByRelation.mockResolvedValue(pool);
		const input = { sourceId, mediaId, limit: 4, seed: "first-visit" };
		const first = await service.getRelated(input);
		const repeated = await service.getRelated(input);
		const refreshed = await service.getRelated({ ...input, seed: "refresh" });
		expect(repeated).toEqual(first);
		expect(
			new Set(refreshed.recommendations.map((item) => item.media.id)),
		).not.toEqual(new Set(first.recommendations.map((item) => item.media.id)));
		expect(
			new Set(first.recommendations.map((item) => item.media.id)).size,
		).toBe(4);
		expect(
			first.recommendations.some(
				(item) =>
					!pool.slice(0, 4).some((initial) => initial.id === item.media.id),
			),
		).toBe(true);
		expect(repository.findRelatedByRelation).toHaveBeenCalledWith(
			mediaId,
			"character",
			96,
			"refresh",
		);
	});

	it("keeps category caps and visual ordering when a low visual match also belongs to other categories", async () => {
		const { repository, store, service } = setup();
		const pool = Array.from({ length: 8 }, (_, index) =>
			media(`candidate-${index}`),
		);
		store.nearestRelated.mockResolvedValue(
			pool.map((item, index) => ({
				mediaId: item.id,
				cosineDistance: 0.1 + index * 0.05,
			})),
		);
		repository.findByIds.mockResolvedValue([...pool].reverse());
		repository.findRelatedByRelation.mockResolvedValue([pool[7], ...pool]);
		repository.findRelatedByTags.mockResolvedValue(
			pool.map((item) => ({ media: item, score: 0.7 })),
		);
		const result = await service.getRelated({
			sourceId,
			mediaId,
			limit: 2,
			seed: "categories",
		});
		expect(
			result.items
				.filter((item) => item.reasons.includes("similar"))
				.map((item) => item.media.id),
		).toEqual(pool.slice(0, 2).map((item) => item.id));
		for (const reason of ["similar", "character", "ip", "tag"] as const) {
			expect(
				result.items.filter((item) => item.reasons.includes(reason)),
			).toHaveLength(2);
		}
		expect(new Set(result.items.map((item) => item.media.id)).size).toBe(
			result.items.length,
		);
		expect(result.recommendations).toHaveLength(2);
	});

	it("gives stronger tag matches more opportunities while keeping weaker matches discoverable", async () => {
		const { repository, service } = setup();
		const strong = media("strong");
		const weak = media("weak");
		repository.findRelatedByTags.mockResolvedValue([
			{ media: strong, score: 0.9 },
			{ media: weak, score: 0.1 },
		]);
		let strongCount = 0;
		for (let index = 0; index < 160; index += 1) {
			const result = await service.getRelated({
				sourceId,
				mediaId,
				limit: 1,
				seed: `visit-${index}`,
			});
			if (result.recommendations[0].media.id === strong.id) strongCount += 1;
		}
		expect(strongCount).toBeGreaterThan(120);
		expect(strongCount).toBeLessThan(160);
	});

	it.each(["author", "tags"] as const)(
		"reduces repeated %s without excluding single-group collections",
		async (mode) => {
			const { repository, service } = setup();
			const pool = Array.from({ length: 4 }, (_, index) =>
				media(`candidate-${index}`),
			);
			repository.findRelatedByTags.mockResolvedValue(
				pool.map((item) => ({ media: item, score: 0.8 })),
			);
			const signals = pool.map((item, index) => ({
				mediaId: item.id,
				authorIds: mode === "author" ? [`author-${Math.floor(index / 2)}`] : [],
				tagIds:
					mode === "tags"
						? [0, 1, 2, 3].map((tag) => `tag-${Math.floor(index / 2)}-${tag}`)
						: [],
			}));
			const repeatedGroup = (ids: string[]) =>
				Math.floor(Number(ids[0].split("-")[1]) / 2) ===
				Math.floor(Number(ids[1].split("-")[1]) / 2);
			let baseline = 0;
			let diverse = 0;
			for (let index = 0; index < 120; index += 1) {
				const input = {
					sourceId,
					mediaId,
					limit: 2,
					seed: `diversity-${index}`,
				};
				repository.getRelatedMediaSignals.mockResolvedValue([]);
				if (
					repeatedGroup(
						(await service.getRelated(input)).recommendations.map(
							(item) => item.media.id,
						),
					)
				)
					baseline += 1;
				repository.getRelatedMediaSignals.mockResolvedValue(signals);
				if (
					repeatedGroup(
						(await service.getRelated(input)).recommendations.map(
							(item) => item.media.id,
						),
					)
				)
					diverse += 1;
			}
			expect(diverse).toBeLessThan(baseline);
			expect(
				(await service.getRelated({ sourceId, mediaId, limit: 4 }))
					.recommendations,
			).toHaveLength(4);
		},
	);

	it("excludes invalid and zero-score tag candidates and reads no signals for an empty pool", async () => {
		const { repository, service } = setup();
		repository.findRelatedByTags.mockResolvedValue([
			{ media: media(), score: 1 },
			{ media: media("archived", { status: "archived" }), score: 1 },
			{ media: media("video", { mediaType: "video" }), score: 1 },
			{ media: media("no-match"), score: 0 },
			{ media: media("invalid"), score: Number.NaN },
		]);
		const result = await service.getRelated({ sourceId, mediaId });
		expect(result.items).toEqual([]);
		expect(result.recommendations).toEqual([]);
		expect(repository.getRelatedMediaSignals).not.toHaveBeenCalled();
	});
});

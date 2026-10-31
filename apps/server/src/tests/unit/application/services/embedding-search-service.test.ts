import { EmbeddingSearchService } from "@solid-imager/application/services/embedding-search-service";
import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
} from "@solid-imager/core/domain/search/embedding";
import { describe, it, expect, vi } from "vitest";

const sourceId = "11111111-1111-4111-8111-111111111111";
const mediaId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";
const vector = Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0));
const media = {
	id: mediaId,
	mediaSourceId: sourceId,
	filePath: "picture.png",
	mediaType: "image",
	modifiedAt: new Date("2026-01-01"),
};

function setup() {
	const encoder = {
		encodeImage: vi.fn().mockResolvedValue(vector),
		encodeText: vi.fn().mockResolvedValue(vector),
	};
	const store = {
		get: vi.fn().mockResolvedValue(null),
		upsert: vi.fn(),
		search: vi.fn().mockResolvedValue({
			candidates: [{ mediaId: candidateId, cosineDistance: 0.1 }],
			total: 40,
		}),
	};
	const mediaRepository = {
		findById: vi.fn().mockResolvedValue(media),
		findByIds: vi.fn().mockResolvedValue([{ ...media, id: candidateId }]),
	};
	const sourceRepository = {
		findById: vi.fn().mockResolvedValue({
			id: sourceId,
			type: "local",
			connectionInfo: { path: "/images" },
		}),
	};
	const service = new EmbeddingSearchService({
		mediaRepository: mediaRepository as any,
		sourceRepository: sourceRepository as any,
		encoder,
		store,
	});
	return { service, encoder, store, mediaRepository, sourceRepository };
}

describe("EmbeddingSearchService", () => {
	it("ranks natural language using image vectors, source scope and the bounded final page", async () => {
		const { service, encoder, store } = setup();
		const result = await service.searchText({
			text: "  夕焼けの海  ",
			mediaSourceId: sourceId,
			topK: 25,
			limit: 20,
			offset: 20,
		});
		expect(encoder.encodeText).toHaveBeenCalledWith("夕焼けの海");
		expect(encoder.encodeImage).not.toHaveBeenCalled();
		expect(store.search).toHaveBeenCalledWith(vector, {
			mediaSourceId: sourceId,
			excludeMediaId: undefined,
			limit: 5,
			offset: 20,
		});
		expect(result.total).toBe(25);
		expect(result.media.map((item) => item.id)).toEqual([candidateId]);
	});

	it("extracts a missing image anchor and excludes it from the results", async () => {
		const { service, store, encoder } = setup();
		await service.searchSimilar(mediaId, 100);
		expect(encoder.encodeImage).toHaveBeenCalledWith("/images/picture.png");
		expect(store.upsert).toHaveBeenCalledWith({
			mediaId,
			vector,
			model: EMBEDDING_GEMMA_MODEL,
			version: EMBEDDING_GEMMA_VERSION,
			mediaModifiedAt: media.modifiedAt,
		});
		expect(store.search).toHaveBeenCalledWith(
			vector,
			expect.objectContaining({ excludeMediaId: mediaId }),
		);
	});

	it("reuses current image embeddings and regenerates stale ones", async () => {
		const { service, store, encoder } = setup();
		store.get.mockResolvedValue({
			mediaId,
			vector,
			mediaModifiedAt: media.modifiedAt,
		});
		await service.extract(sourceId, mediaId);
		expect(encoder.encodeImage).not.toHaveBeenCalled();
		store.get.mockResolvedValue({
			mediaId,
			vector,
			mediaModifiedAt: new Date("2025-01-01"),
		});
		await service.extract(sourceId, mediaId);
		expect(encoder.encodeImage).toHaveBeenCalledOnce();
	});

	it("rejects blank queries, invalid vectors, mismatched sources, and non-image anchors", async () => {
		const { service, encoder, mediaRepository } = setup();
		await expect(
			service.searchText({ text: " ", topK: 10, limit: 20, offset: 0 }),
		).rejects.toThrow();
		encoder.encodeText.mockResolvedValue(Array(768).fill(0));
		await expect(
			service.searchText({ text: "海", topK: 10, limit: 20, offset: 0 }),
		).rejects.toThrow();
		await expect(service.extract(candidateId, mediaId)).rejects.toThrow(
			"Media not found in source",
		);
		mediaRepository.findById.mockResolvedValue({
			...media,
			mediaType: "video",
		});
		await expect(service.searchSimilar(mediaId, 10)).rejects.toThrow(
			"images only",
		);
	});
});

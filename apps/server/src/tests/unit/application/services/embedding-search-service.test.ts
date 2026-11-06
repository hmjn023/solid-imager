import { EmbeddingSearchService } from "@solid-imager/application/embeddings";
import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
} from "@solid-imager/core/search";
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
	const resolveVideoThumbnail = vi
		.fn()
		.mockResolvedValue("/thumbnails/video.webp");
	const service = new EmbeddingSearchService({
		mediaRepository: mediaRepository as any,
		sourceRepository: sourceRepository as any,
		encoder,
		store,
		resolveVideoThumbnail,
	});
	return {
		service,
		encoder,
		store,
		mediaRepository,
		sourceRepository,
		resolveVideoThumbnail,
	};
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
		const { service, store, encoder, resolveVideoThumbnail } = setup();
		await service.searchSimilar(mediaId, 100);
		expect(encoder.encodeImage).toHaveBeenCalledWith("/images/picture.png");
		expect(resolveVideoThumbnail).not.toHaveBeenCalled();
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

	it("extracts a video thumbnail and makes the original video the similarity anchor", async () => {
		const { service, store, encoder, mediaRepository, resolveVideoThumbnail } =
			setup();
		const video = { ...media, filePath: "clip.mp4", mediaType: "video" };
		mediaRepository.findById.mockResolvedValue(video);
		await service.searchSimilar(mediaId, 100);
		expect(resolveVideoThumbnail).toHaveBeenCalledWith(video);
		expect(encoder.encodeImage).toHaveBeenCalledWith("/thumbnails/video.webp");
		expect(encoder.encodeImage).not.toHaveBeenCalledWith("/images/clip.mp4");
		expect(store.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				mediaId,
				mediaModifiedAt: video.modifiedAt,
			}),
		);
		expect(store.search).toHaveBeenCalledWith(
			vector,
			expect.objectContaining({ excludeMediaId: mediaId }),
		);
	});

	it("reuses current video embeddings without resolving a thumbnail, and resolves stale or forced vectors", async () => {
		const { service, store, encoder, mediaRepository, resolveVideoThumbnail } =
			setup();
		mediaRepository.findById.mockResolvedValue({
			...media,
			mediaType: "video",
		});
		const current = { mediaId, vector, mediaModifiedAt: media.modifiedAt };
		store.get.mockResolvedValue(current);
		expect(await service.extract(sourceId, mediaId)).toEqual(current);
		expect(resolveVideoThumbnail).not.toHaveBeenCalled();
		expect(encoder.encodeImage).not.toHaveBeenCalled();
		store.get.mockResolvedValue({
			...current,
			mediaModifiedAt: new Date("2025-01-01"),
		});
		await service.extract(sourceId, mediaId);
		expect(resolveVideoThumbnail).toHaveBeenCalledTimes(1);
		store.get.mockResolvedValue(current);
		await service.extract(sourceId, mediaId, true);
		expect(resolveVideoThumbnail).toHaveBeenCalledTimes(2);
		expect(encoder.encodeImage).toHaveBeenCalledTimes(2);
	});

	it("propagates video thumbnail failure without encoding or storing a vector", async () => {
		const { service, store, encoder, mediaRepository, resolveVideoThumbnail } =
			setup();
		mediaRepository.findById.mockResolvedValue({
			...media,
			mediaType: "video",
		});
		resolveVideoThumbnail.mockRejectedValue(
			new Error("Unable to decode video"),
		);
		await expect(service.extract(sourceId, mediaId)).rejects.toThrow(
			"Unable to decode video",
		);
		expect(encoder.encodeImage).not.toHaveBeenCalled();
		expect(store.upsert).not.toHaveBeenCalled();
	});

	it("rejects blank queries, invalid vectors, mismatched sources, audio and remote videos", async () => {
		const {
			service,
			encoder,
			mediaRepository,
			sourceRepository,
			resolveVideoThumbnail,
		} = setup();
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
			mediaType: "audio",
		});
		await expect(service.searchSimilar(mediaId, 10)).rejects.toThrow(
			"images and video thumbnails only",
		);
		mediaRepository.findById.mockResolvedValue({
			...media,
			mediaType: "video",
		});
		await expect(service.extract(candidateId, mediaId)).rejects.toThrow(
			"Media not found in source",
		);
		sourceRepository.findById.mockResolvedValue({ id: sourceId, type: "s3" });
		await expect(service.extract(sourceId, mediaId)).rejects.toThrow(
			"requires a local source",
		);
		expect(resolveVideoThumbnail).not.toHaveBeenCalled();
		expect(encoder.encodeImage).not.toHaveBeenCalled();
	});
});

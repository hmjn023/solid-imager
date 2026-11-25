import { call } from "@orpc/server";
import type {
	Media,
	SimilarMediaSearchResponse,
} from "@solid-imager/core/media";
import { expect, it, vi } from "vitest";
import { mediaToolsRouter } from "~/infrastructure/api/routers/media-tools-router";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";

const { searchText } = vi.hoisted(() => ({ searchText: vi.fn() }));

vi.mock("~/infrastructure/services/ccip-vector-service", () => ({
	ccipVectorService: { searchSimilar: vi.fn() },
}));
vi.mock("~/infrastructure/services/embedding-search-service", () => ({
	getEmbeddingSearchService: () => ({ searchText }),
}));

const sourceId = "11111111-1111-4111-8111-111111111111";
const anchorMediaId = "22222222-2222-4222-8222-222222222222";
const mediaOrigin = "https://imager.example.test";
const context = { mediaOrigin };
const image: Media = {
	id: "33333333-3333-4333-8333-333333333333",
	mediaSourceId: sourceId,
	fileName: "first.png",
	filePath: "private/first.png",
	mediaType: "image",
	width: 256,
	height: 192,
	fileSize: 300,
	description: null,
	createdAt: new Date(0),
	modifiedAt: new Date(0),
	indexedAt: new Date(0),
	status: "active",
};
const video: Media = {
	...image,
	id: "44444444-4444-4444-8444-444444444444",
	fileName: "second.mp4",
	filePath: "private/second.mp4",
	mediaType: "video",
};
const rankedResult: SimilarMediaSearchResponse = {
	media: [image, video],
	total: 9,
	scores: [
		{ mediaId: video.id, cosineDistance: 0.25 },
		{ mediaId: image.id, cosineDistance: 0 },
	],
};
const expectedPage = {
	total: 9,
	media: rankedResult.media.map(({ id, fileName, mediaType }, index) => ({
		id,
		mediaSourceId: sourceId,
		fileName,
		mediaType,
		width: 256,
		height: 192,
		thumbnailUrl: `${mediaOrigin}/api/sources/${sourceId}/media/${id}/thumbnail`,
		cosineDistance: index === 0 ? 0 : 0.25,
	})),
};

it("keeps ranked media order and joins CCIP distances to compact results by ID", async () => {
	const searchSimilar = vi.mocked(ccipVectorService.searchSimilar);
	searchSimilar.mockResolvedValueOnce(rankedResult);

	await expect(
		call(
			mediaToolsRouter.search_similar_media,
			{
				anchorMediaId,
				mediaSourceId: sourceId,
				topK: 10,
				limit: 2,
				offset: 4,
			},
			{ context },
		),
	).resolves.toEqual(expectedPage);
	expect(searchSimilar).toHaveBeenCalledWith(anchorMediaId, 10, sourceId, 2, 4);
});

it("uses the same compact results and preserves the final empty semantic page", async () => {
	searchText
		.mockResolvedValueOnce(rankedResult)
		.mockResolvedValueOnce({ media: [], total: 0, scores: [] });
	const input = {
		text: "A cat",
		mediaSourceId: sourceId,
		topK: 9,
		limit: 2,
		offset: 6,
	};

	await expect(
		call(mediaToolsRouter.search_semantic_media, input, { context }),
	).resolves.toEqual(expectedPage);
	expect(searchText).toHaveBeenCalledWith(input);
	await expect(
		call(
			mediaToolsRouter.search_semantic_media,
			{ ...input, offset: 9 },
			{ context },
		),
	).resolves.toEqual({ total: 0, media: [] });
});

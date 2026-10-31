import path from "node:path";
import type { SimilarMediaSearchResponse } from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
	embeddingVectorSchema,
	semanticSearchRequestSchema,
} from "@solid-imager/core/domain/search/embedding";
import type { SemanticSearchRequest } from "@solid-imager/core/domain/search/embedding";
import type {
	IEmbeddingEncoder,
	IEmbeddingStore,
	ImageEmbedding,
} from "../ports/embedding-store";

export class EmbeddingSearchService {
	constructor(
		private readonly deps: {
			mediaRepository: IMediaRepository;
			sourceRepository: SourceRepository;
			encoder: IEmbeddingEncoder;
			store: IEmbeddingStore;
		},
	) {}

	async extract(
		mediaSourceId: string,
		mediaId: string,
		force = false,
	): Promise<ImageEmbedding> {
		const media = await this.deps.mediaRepository.findById(mediaId);
		if (!media || media.mediaSourceId !== mediaSourceId)
			throw new Error("Media not found in source");
		if (media.mediaType !== "image")
			throw new Error("EmbeddingGemma 2 supports images only");
		const source = await this.deps.sourceRepository.findById(mediaSourceId);
		if (!source || source.type !== "local")
			throw new Error("EmbeddingGemma 2 extraction requires a local source");
		const connection = localConnectionSchema.parse(source.connectionInfo);
		const existing = force ? null : await this.deps.store.get(mediaId);
		if (
			existing &&
			existing.mediaModifiedAt.getTime() === media.modifiedAt.getTime()
		)
			return existing;
		const vector = embeddingVectorSchema.parse(
			await this.deps.encoder.encodeImage(
				path.join(connection.path, media.filePath),
			),
		);
		const record: ImageEmbedding = {
			mediaId,
			vector,
			model: EMBEDDING_GEMMA_MODEL,
			version: EMBEDDING_GEMMA_VERSION,
			mediaModifiedAt: media.modifiedAt,
		};
		await this.deps.store.upsert(record);
		return record;
	}

	async searchSimilar(
		anchorMediaId: string,
		topK: number,
		mediaSourceId?: string,
		limit = 20,
		offset = 0,
	): Promise<SimilarMediaSearchResponse> {
		const media = await this.deps.mediaRepository.findById(anchorMediaId);
		if (!media) throw new Error("Anchor media not found");
		const record = await this.extract(media.mediaSourceId, anchorMediaId);
		return this.search(
			record.vector,
			{ topK, mediaSourceId, limit, offset },
			anchorMediaId,
		);
	}

	async searchText(
		input: SemanticSearchRequest,
	): Promise<SimilarMediaSearchResponse> {
		const parsed = semanticSearchRequestSchema.parse(input);
		const vector = embeddingVectorSchema.parse(
			await this.deps.encoder.encodeText(parsed.text),
		);
		return this.search(vector, parsed);
	}

	private async search(
		vector: number[],
		input: Pick<
			SemanticSearchRequest,
			"topK" | "mediaSourceId" | "limit" | "offset"
		>,
		excludeMediaId?: string,
	): Promise<SimilarMediaSearchResponse> {
		if (input.offset >= input.topK) return { media: [], scores: [], total: 0 };
		const result = await this.deps.store.search(vector, {
			mediaSourceId: input.mediaSourceId,
			excludeMediaId,
			limit: Math.min(input.limit, input.topK - input.offset),
			offset: input.offset,
		});
		const media = await this.deps.mediaRepository.findByIds(
			result.candidates.map((item) => item.mediaId),
		);
		const byId = new Map(media.map((item) => [item.id, item]));
		return {
			media: result.candidates.flatMap((item) => {
				const value = byId.get(item.mediaId);
				return value ? [value] : [];
			}),
			scores: result.candidates.filter((item) => byId.has(item.mediaId)),
			total: Math.min(result.total, input.topK),
		};
	}
}

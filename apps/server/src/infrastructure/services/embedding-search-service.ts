import { EmbeddingSearchService } from "@solid-imager/application/embeddings";
import { PostgresEmbeddingStore } from "~/infrastructure/ai/postgres-embedding-store";
import { db } from "~/infrastructure/db";
import { services } from "~/infrastructure/service-registry";
import { resolveVideoThumbnail } from "./video-thumbnail";

export function getEmbeddingSearchService(): EmbeddingSearchService {
	return new EmbeddingSearchService({
		mediaRepository: services.getMediaRepository(),
		sourceRepository: services.getSourceRepository(),
		resolveVideoThumbnail,
		store: new PostgresEmbeddingStore(db),
		encoder: {
			encodeImage: (filePath) =>
				services.getAiClient().extractImageEmbeddingByPath(filePath),
			encodeText: (text) => services.getAiClient().extractTextEmbedding(text),
		},
	});
}

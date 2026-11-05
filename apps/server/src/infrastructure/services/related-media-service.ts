import { RelatedMediaService } from "@solid-imager/application/media";
import { PostgresEmbeddingStore } from "~/infrastructure/ai/postgres-embedding-store";
import { db } from "~/infrastructure/db";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";

export function getRelatedMediaService(): RelatedMediaService {
	return new RelatedMediaService({
		mediaRepository: services.getMediaRepository(),
		embeddingStore: new PostgresEmbeddingStore(db),
		logger,
	});
}

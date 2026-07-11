import type {
	Media,
	SimilarMediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { asyncPool } from "@solid-imager/core/utils/async-pool";
import type {
	CcipVectorMetadata,
	CcipVectorRecord,
	ICcipVectorStore,
} from "../ports/ccip-vector-store";
import type { ITaggingService } from "../ports/tagging-service";

export const CCIP_MODEL = "ccip-caformer-24-randaug-pruned";
export const CCIP_EMBEDDING_VERSION = 1;
const MIN_CANDIDATES = 100;
const CANDIDATE_MULTIPLIER = 5;
const MAX_CANDIDATES = 1000;

export type CcipVectorServiceDeps = {
	mediaRepository: IMediaRepository;
	sourceRepository: SourceRepository;
	taggingService: ITaggingService;
	vectorStore: ICcipVectorStore;
};

export class CcipVectorService {
	constructor(private readonly deps: CcipVectorServiceDeps) {}

	async extract(
		mediaSourceId: string,
		mediaId: string,
		force = false,
	): Promise<{ record: CcipVectorRecord; skipped: boolean }> {
		const existing = force ? null : await this.deps.vectorStore.get(mediaId);
		const result = await this.prepareExtraction(
			mediaSourceId,
			mediaId,
			existing,
		);
		if (!result.skipped) {
			await this.deps.vectorStore.upsert(result.record);
		}
		return result;
	}

	async extractBatch(
		mediaSourceId: string,
		mediaIds: string[],
		force = false,
		concurrency = 1,
	): Promise<
		PromiseSettledResult<{
			mediaId: string;
			record: CcipVectorRecord;
			skipped: boolean;
		}>[]
	> {
		if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
			throw new Error("concurrency must be a positive integer");
		}
		const existingById = force
			? new Map<string, CcipVectorRecord>()
			: await this.deps.vectorStore.getMany(mediaIds);
		const results = await asyncPool(mediaIds, concurrency, async (mediaId) => ({
			mediaId,
			...(await this.prepareExtraction(
				mediaSourceId,
				mediaId,
				existingById.get(mediaId) ?? null,
			)),
		}));
		const records = results.flatMap((result) =>
			result.status === "fulfilled" && !result.value.skipped
				? [result.value.record]
				: [],
		);
		await this.deps.vectorStore.upsertMany(records);
		return results;
	}

	private async prepareExtraction(
		mediaSourceId: string,
		mediaId: string,
		existing: CcipVectorRecord | null,
	): Promise<{ record: CcipVectorRecord; skipped: boolean }> {
		const media = await this.requireImage(mediaSourceId, mediaId);
		if (existing && this.isCurrent(existing, media, mediaSourceId)) {
			return { record: existing, skipped: true };
		}

		const result = await this.deps.taggingService.getCcipFeatureForMedia(
			mediaSourceId,
			mediaId,
		);
		const record: CcipVectorRecord = {
			mediaId,
			mediaSourceId,
			vector: result.feature,
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
			mediaModifiedAt: media.modifiedAt,
			extractedAt: new Date(),
		};
		return { record, skipped: false };
	}

	async getStatus(
		mediaSourceId: string,
		mediaId: string,
	): Promise<{
		status: "missing" | "ready" | "stale";
		model?: string;
		extractedAt?: Date;
	}> {
		const media = await this.requireImage(mediaSourceId, mediaId);
		const record = await this.deps.vectorStore.get(mediaId);
		if (!record) return { status: "missing" };
		return {
			status: this.isCurrent(record, media, mediaSourceId) ? "ready" : "stale",
			model: record.model,
			extractedAt: record.extractedAt,
		};
	}

	async delete(mediaId: string): Promise<void> {
		await this.deps.vectorStore.delete(mediaId);
	}

	async deleteBySource(mediaSourceId: string): Promise<void> {
		await this.deps.vectorStore.deleteBySource(mediaSourceId);
	}

	async getMany(mediaIds: string[]): Promise<Map<string, CcipVectorRecord>> {
		return await this.deps.vectorStore.getMany(mediaIds);
	}

	async getMetadataMany(
		mediaIds: string[],
	): Promise<Map<string, CcipVectorMetadata>> {
		return await this.deps.vectorStore.getMetadataMany(mediaIds);
	}

	async listExtractedMediaIds(mediaSourceId?: string): Promise<string[]> {
		return await this.deps.vectorStore.listMediaIds(mediaSourceId);
	}

	async listRecords(mediaSourceId?: string): Promise<CcipVectorRecord[]> {
		return await this.deps.vectorStore.list(mediaSourceId);
	}

	async searchSimilar(
		anchorMediaId: string,
		topK: number,
		mediaSourceId?: string,
	): Promise<SimilarMediaSearchResponse> {
		const anchorMedia = await this.deps.mediaRepository.findById(anchorMediaId);
		if (!anchorMedia) throw new Error(`Media not found: ${anchorMediaId}`);
		const anchor = await this.deps.vectorStore.get(anchorMediaId);
		if (
			!anchor ||
			!this.isCurrent(anchor, anchorMedia, anchorMedia.mediaSourceId)
		) {
			throw new Error("CCIP vector is missing or stale for the anchor media");
		}

		const candidateLimit = Math.min(
			Math.max(topK * CANDIDATE_MULTIPLIER, MIN_CANDIDATES),
			MAX_CANDIDATES,
		);
		const candidates = (
			await this.deps.vectorStore.search(
				anchor.vector,
				candidateLimit + 1,
				mediaSourceId,
			)
		).filter((candidate) => candidate.mediaId !== anchorMediaId);
		if (candidates.length === 0) {
			return { media: [], total: 0, scores: [] };
		}
		const media = await this.deps.mediaRepository.findByIds(
			candidates.map((candidate) => candidate.mediaId),
		);
		const mediaById = new Map(media.map((item) => [item.id, item]));
		const currentCandidates = candidates.filter((candidate) => {
			const item = mediaById.get(candidate.mediaId);
			return item ? this.isCurrent(candidate, item, item.mediaSourceId) : false;
		});
		if (currentCandidates.length === 0) {
			return { media: [], total: 0, scores: [] };
		}
		const distances = await this.deps.taggingService.getCcipDistances(
			anchor.vector,
			currentCandidates.map((candidate) => candidate.vector),
		);
		const ranked = currentCandidates
			.map((candidate, index) => ({
				candidate,
				ccipDistance: distances[index],
			}))
			.filter(
				(item): item is typeof item & { ccipDistance: number } =>
					item.ccipDistance !== undefined,
			)
			.sort((left, right) => left.ccipDistance - right.ccipDistance)
			.slice(0, topK);

		const rankedMedia = ranked.flatMap((item) => {
			const value = mediaById.get(item.candidate.mediaId);
			return value ? [value] : [];
		});
		return {
			media: rankedMedia,
			total: rankedMedia.length,
			scores: ranked.map((item) => ({
				mediaId: item.candidate.mediaId,
				cosineDistance: item.candidate.cosineDistance,
				ccipDistance: item.ccipDistance,
			})),
		};
	}

	private isCurrent(
		record: CcipVectorRecord,
		media: Media,
		mediaSourceId: string,
	): boolean {
		return (
			record.model === CCIP_MODEL &&
			record.embeddingVersion === CCIP_EMBEDDING_VERSION &&
			record.mediaSourceId === mediaSourceId &&
			// A vector extracted after the media's latest modification represents
			// the current file, regardless of LanceDB timestamp serialization.
			record.extractedAt.getTime() >= media.modifiedAt.getTime()
		);
	}

	private async requireImage(
		mediaSourceId: string,
		mediaId: string,
	): Promise<Media> {
		const media = await this.deps.mediaRepository.findById(mediaId);
		if (!media || media.mediaSourceId !== mediaSourceId) {
			throw new Error("Media not found in source");
		}
		if (media.mediaType !== "image") {
			throw new Error("CCIP vector extraction is only supported for images");
		}
		const source = await this.deps.sourceRepository.findById(mediaSourceId);
		if (!source) throw new Error("Media source not found");
		if (source.type !== "local") {
			throw new Error("CCIP vector extraction only supports local sources");
		}
		return media;
	}
}

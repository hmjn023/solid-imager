import type {
	Media,
	SimilarMediaSearchResponse,
	IMediaRepository,
} from "@solid-imager/core/media";
import type { SourceRepository } from "@solid-imager/core/sources";
import { asyncPool } from "@solid-imager/core/utils";
import type {
	CcipVectorMetadata,
	CcipVectorRecord,
	ICcipVectorStore,
} from "../ports/ccip-vector-store";
import type { ILogger } from "../ports/logger";
import type { ITaggingService } from "../ports/tagging-service";

/** Model identifier used to partition current CCIP vectors. */
export const CCIP_MODEL = "ccip-caformer-24-randaug-pruned";
/** Version of the current CCIP embedding space. */
export const CCIP_EMBEDDING_VERSION = 1;

/** Storage, inference and media dependencies used for CCIP extraction and search. */
export type CcipVectorServiceDeps = {
	mediaRepository: IMediaRepository;
	sourceRepository: SourceRepository;
	taggingService: ITaggingService;
	vectorStore: ICcipVectorStore;
	logger?: ILogger;
};

/** Extracts and searches CCIP vectors, reusing records that are current for the media. */
export class CcipVectorService {
	constructor(private readonly deps: CcipVectorServiceDeps) {}

	/**
	 * Extract and persist a CCIP vector for an image in a local source.
	 * @param mediaSourceId - Source expected to own the image.
	 * @param mediaId - Image to encode.
	 * @param force - Recompute even when a current vector exists; defaults to false.
	 * @returns The vector and whether an existing current record was reused.
	 * @throws If the media is missing, belongs to another source, is not an image, or the source is not local. Inference and storage failures propagate.
	 */
	async extract(
		mediaSourceId: string,
		mediaId: string,
		force = false,
	): Promise<{ record: CcipVectorRecord; skipped: boolean }> {
		const existing = force
			? null
			: await this.deps.vectorStore.get(mediaId, this.currentVectorQuery());
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

	/**
	 * Extract vectors concurrently, then persist the successfully extracted records.
	 * @param mediaSourceId - Source expected to own the images.
	 * @param mediaIds - Images to process, in result order.
	 * @param force - Recompute current records when true; defaults to false.
	 * @param concurrency - Maximum concurrent extractions; defaults to 1 and must be a positive integer.
	 * @returns A settled result for each input, including individual extraction failures.
	 * @throws If concurrency is invalid or the batch read or write fails.
	 */
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
			: await this.deps.vectorStore.getMany(
					mediaIds,
					this.currentVectorQuery(),
				);
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
		const record = await this.deps.vectorStore.get(
			mediaId,
			this.currentVectorQuery(),
		);
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
		return await this.deps.vectorStore.getMany(
			mediaIds,
			this.currentVectorQuery(),
		);
	}

	async getMetadataMany(
		mediaIds: string[],
	): Promise<Map<string, CcipVectorMetadata>> {
		return await this.deps.vectorStore.getMetadataMany(
			mediaIds,
			this.currentVectorQuery(),
		);
	}

	async listExtractedMediaIds(mediaSourceId?: string): Promise<string[]> {
		return await this.deps.vectorStore.listMediaIds({
			...this.currentVectorQuery(),
			mediaSourceId,
		});
	}

	async listRecords(mediaSourceId?: string): Promise<CcipVectorRecord[]> {
		return await this.deps.vectorStore.list({
			...this.currentVectorQuery(),
			mediaSourceId,
		});
	}

	/**
	 * Return a cosine-ranked page bounded by the requested total result cap.
	 * @param anchorMediaId - Image whose current vector is used as the query and excluded from results.
	 * @param topK - Maximum number of results across pages.
	 * @param mediaSourceId - Optional source filter for candidates.
	 * @param limit - Maximum page size; defaults to 20.
	 * @param offset - Number of ranked candidates to skip; defaults to 0.
	 * @returns Ranked media and corresponding scores, with a total capped at topK.
	 * @throws If the anchor is missing or its CCIP vector is missing or stale.
	 */
	async searchSimilar(
		anchorMediaId: string,
		topK: number,
		mediaSourceId?: string,
		limit = 20,
		offset = 0,
	): Promise<SimilarMediaSearchResponse> {
		const anchorMedia = await this.deps.mediaRepository.findById(anchorMediaId);
		if (!anchorMedia) throw new Error(`Media not found: ${anchorMediaId}`);
		const anchor = await this.deps.vectorStore.get(
			anchorMediaId,
			this.currentVectorQuery(),
		);
		if (
			!anchor ||
			!this.isCurrent(anchor, anchorMedia, anchorMedia.mediaSourceId)
		) {
			throw new Error("CCIP vector is missing or stale for the anchor media");
		}

		if (offset >= topK) return { media: [], total: 0, scores: [] };
		const { candidates, total } = await this.deps.vectorStore.search(
			anchor.vector,
			Math.min(limit, topK - offset),
			{
				...this.currentVectorQuery(),
				mediaSourceId,
			},
			offset,
			anchorMediaId,
		);
		if (candidates.length === 0) {
			return { media: [], total: 0, scores: [] };
		}
		const media = await this.deps.mediaRepository.findByIds(
			candidates.map((candidate) => candidate.mediaId),
		);
		const mediaById = new Map(media.map((item) => [item.id, item]));
		const rankedMedia = candidates.flatMap((item) => {
			const value = mediaById.get(item.mediaId);
			return value ? [value] : [];
		});
		return {
			media: rankedMedia,
			total: Math.min(total, topK),
			scores: candidates.filter((item) => mediaById.has(item.mediaId)),
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
			// the current file, regardless of timestamp serialization.
			record.extractedAt.getTime() >= media.modifiedAt.getTime()
		);
	}

	private currentVectorQuery() {
		return {
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
		};
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

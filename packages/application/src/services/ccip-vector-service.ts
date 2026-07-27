import type {
	Media,
	SimilarMediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import {
	createCcipEmbeddingInputRevision,
	createMediaSourceRevision,
} from "@solid-imager/core/domain/media/revision";
import { asyncPool } from "@solid-imager/core/utils/async-pool";
import type {
	CcipVectorMetadata,
	CcipVectorRecord,
	ICcipVectorStore,
} from "../ports/ccip-vector-store";
import type { ILogger } from "../ports/media-service";
import type { ITaggingService } from "../ports/tagging-service";

export const CCIP_MODEL = "ccip-caformer-24-randaug-pruned";
export const CCIP_EMBEDDING_VERSION = 1;
export const CCIP_PREPROCESSING_PROFILE =
	"dghs-imgutils-rs/full-image-default/v1";
const MIN_CANDIDATES = 100;
const CANDIDATE_MULTIPLIER = 5;
const MAX_CANDIDATES = 1000;

export type CcipVectorServiceDeps = {
	mediaRepository: IMediaRepository;
	sourceRepository: SourceRepository;
	taggingService: ITaggingService;
	vectorStore: ICcipVectorStore;
	logger?: ILogger;
};

export class CcipVectorService {
	constructor(private readonly deps: CcipVectorServiceDeps) {}

	async extract(
		mediaSourceId: string,
		mediaId: string,
		force = false,
		signal?: AbortSignal,
	): Promise<{ record: CcipVectorRecord; skipped: boolean }> {
		signal?.throwIfAborted();
		const existing = force
			? null
			: await this.deps.vectorStore.get(mediaId, this.currentVectorQuery());
		const result = await this.prepareExtraction(
			mediaSourceId,
			mediaId,
			existing,
			signal,
		);
		if (!result.skipped) {
			signal?.throwIfAborted();
			await this.deps.vectorStore.upsert(result.record);
		}
		return result;
	}

	async extractBatch(
		mediaSourceId: string,
		mediaIds: string[],
		force = false,
		concurrency = 1,
		signal?: AbortSignal,
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
				signal,
			)),
		}));
		const records = results.flatMap((result) =>
			result.status === "fulfilled" && !result.value.skipped
				? [result.value.record]
				: [],
		);
		signal?.throwIfAborted();
		await this.deps.vectorStore.upsertMany(records);
		return results;
	}

	private async prepareExtraction(
		mediaSourceId: string,
		mediaId: string,
		existing: CcipVectorRecord | null,
		signal?: AbortSignal,
	): Promise<{ record: CcipVectorRecord; skipped: boolean }> {
		signal?.throwIfAborted();
		const media = await this.requireImage(mediaSourceId, mediaId);
		const inputRevision = await this.inputRevision(media);
		if (
			existing &&
			(await this.isCurrent(existing, media, mediaSourceId, inputRevision))
		) {
			return { record: existing, skipped: true };
		}

		const result = await this.deps.taggingService.getCcipFeatureForMedia(
			mediaSourceId,
			mediaId,
			signal,
		);
		signal?.throwIfAborted();
		const mediaAfterExtraction = await this.requireImage(mediaSourceId, mediaId);
		const commitRevision = await this.inputRevision(mediaAfterExtraction);
		if (commitRevision !== inputRevision) {
			throw new Error("CCIP input changed while the vector was being extracted");
		}
		const record: CcipVectorRecord = {
			regionId: null,
			regionKind: "full",
			mediaId,
			mediaSourceId,
			vector: result.feature,
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
			mediaModifiedAt: media.modifiedAt,
			inputRevision,
			preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
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
		const inputRevision = await this.inputRevision(media);
		return {
			status: (await this.isCurrent(
				record,
				media,
				mediaSourceId,
				inputRevision,
			))
				? "ready"
				: "stale",
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

	async searchSimilar(
		anchorMediaId: string,
		topK: number,
		mediaSourceId?: string,
	): Promise<SimilarMediaSearchResponse> {
		const anchorMedia = await this.deps.mediaRepository.findById(anchorMediaId);
		if (!anchorMedia) throw new Error(`Media not found: ${anchorMediaId}`);
		const anchor = await this.deps.vectorStore.get(
			anchorMediaId,
			this.currentVectorQuery(),
		);
		if (
			!anchor ||
			!(await this.isCurrent(anchor, anchorMedia, anchorMedia.mediaSourceId))
		) {
			throw new Error("CCIP vector is missing or stale for the anchor media");
		}

		const candidateLimit = Math.min(
			Math.max(topK * CANDIDATE_MULTIPLIER, MIN_CANDIDATES),
			MAX_CANDIDATES,
		);
		const candidates = (
			await this.deps.vectorStore.search(anchor.vector, candidateLimit + 1, {
				...this.currentVectorQuery(),
				mediaSourceId,
			})
		).filter((candidate) => candidate.mediaId !== anchorMediaId);
		this.deps.logger?.info(
			{ candidateCount: candidates.length, candidateLimit },
			"CCIP vector candidates loaded",
		);
		if (candidates.length === 0) {
			return { media: [], total: 0, scores: [] };
		}
		const mediaStartedAt = performance.now();
		const media = await this.deps.mediaRepository.findByIds(
			candidates.map((candidate) => candidate.mediaId),
		);
		this.deps.logger?.info(
			{
				durationMs:
					Math.round((performance.now() - mediaStartedAt) * 100) / 100,
				mediaCount: media.length,
				candidateCount: candidates.length,
			},
			"CCIP similar media lookup completed",
		);
		const mediaById = new Map(media.map((item) => [item.id, item]));
		const candidateCurrent = await Promise.all(
			candidates.map(async (candidate) => {
				const item = mediaById.get(candidate.mediaId);
				return item
					? await this.isCurrent(candidate, item, item.mediaSourceId)
					: false;
			}),
		);
		const currentCandidates = candidates.filter(
			(_candidate, index) => candidateCurrent[index],
		);
		if (currentCandidates.length === 0) {
			return { media: [], total: 0, scores: [] };
		}
		const rerankStartedAt = performance.now();
		const distances = await this.deps.taggingService.getCcipDistances(
			anchor.vector,
			currentCandidates.map((candidate) => candidate.vector),
		);
		this.deps.logger?.info(
			{
				durationMs:
					Math.round((performance.now() - rerankStartedAt) * 100) / 100,
				candidateCount: currentCandidates.length,
			},
			"CCIP Rust reranking completed",
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

	private async isCurrent(
		record: CcipVectorRecord,
		media: Media,
		mediaSourceId: string,
		knownRevision?: string,
	): Promise<boolean> {
		const currentRevision =
			knownRevision ?? (await this.inputRevision(media));
		return (
			record.model === CCIP_MODEL &&
			record.embeddingVersion === CCIP_EMBEDDING_VERSION &&
			record.preprocessingProfile === CCIP_PREPROCESSING_PROFILE &&
			record.mediaSourceId === mediaSourceId &&
			(record.inputRevision === currentRevision ||
				(record.inputRevision === "legacy-unversioned" &&
					record.mediaModifiedAt.getTime() === media.modifiedAt.getTime()))
		);
	}

	private async sourceRevision(media: Media): Promise<string> {
		return await createMediaSourceRevision({
			mediaId: media.id,
			mediaSourceId: media.mediaSourceId,
			modifiedAt: media.modifiedAt,
			fileSize: media.fileSize,
			width: media.width,
			height: media.height,
		});
	}

	private async inputRevision(media: Media): Promise<string> {
		return await createCcipEmbeddingInputRevision({
			sourceRevision: await this.sourceRevision(media),
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
			preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
		});
	}

	private currentVectorQuery() {
		return {
			regionKind: "full" as const,
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
			preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
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

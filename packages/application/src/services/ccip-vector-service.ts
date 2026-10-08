import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { SourceEventPublisher } from "@solid-imager/core/domain/sources/events";
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
import type { ILogger } from "../ports/media-service";
import type { ITaggingService } from "../ports/tagging-service";

import { createHash } from "node:crypto";
import {
	serializeMediaProcessingInput,
	type CcipProcessingSettings,
	type MediaProcessingInput,
	type ProcessingOwner,
	type ProcessingRequestIdentity,
} from "@solid-imager/core/domain/processing/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { CcipVectorStatus } from "@solid-imager/core/domain/tagging/schemas";
import {
	AiMediaTaskService,
	canReuseAiResult,
	type AiMediaTaskDeps,
} from "./ai-media-task-service";
export {
	CCIP_MODEL,
	CCIP_EMBEDDING_VERSION,
} from "@solid-imager/core/domain/processing/schemas";

export function getCcipTaskRevision(
	input: MediaProcessingInput,
	settings: CcipProcessingSettings,
): string {
	return createHash("sha256")
		.update(
			JSON.stringify([
				"full-ccip-v1",
				serializeMediaProcessingInput(input),
				input.mediaType,
				settings.model,
				settings.modelVersion,
				settings.runtimeVersion,
				settings.provider,
				settings.device,
				settings.endpoint,
				settings.embeddingVersion,
				settings.dimensions,
			]),
		)
		.digest("hex");
}

const MIN_CANDIDATES = 100;
const CANDIDATE_MULTIPLIER = 5;
const MAX_CANDIDATES = 1000;

export type CcipVectorServiceDeps = Omit<
	AiMediaTaskDeps,
	"mediaRepo" | "sourceRepo"
> & {
	publishSourceEvent?: SourceEventPublisher;
	getCcipSettings: () => CcipProcessingSettings;
	mediaRepository: IMediaRepository;
	sourceRepository: SourceRepository;
	taggingService: ITaggingService;
	vectorStore: ICcipVectorStore;
	logger?: ILogger;
};

export class CcipVectorService {
	private readonly tasks: AiMediaTaskService<CcipVectorRecord>;
	constructor(private readonly deps: CcipVectorServiceDeps) {
		this.tasks = new AiMediaTaskService(
			{
				...deps,
				mediaRepo: deps.mediaRepository,
				sourceRepo: deps.sourceRepository,
			},
			"ccip",
			{
				currentRevision: (input) =>
					getCcipTaskRevision(input, deps.getCcipSettings()),
				canReuse: () => canReuseAiResult(deps.getCcipSettings()),
				load: async (input, tx) => {
					const record = await deps.vectorStore.get(
						input.mediaId,
						this.currentVectorQuery(),
						tx,
					);
					return record?.processingRevision ===
						getCcipTaskRevision(input, deps.getCcipSettings())
						? record
						: null;
				},
				infer: async (input) => {
					const settings = deps.getCcipSettings();
					const response = await deps.taggingService.inferCcip(input);
					return {
						mediaId: input.mediaId,
						mediaSourceId: input.mediaSourceId,
						vector: response.feature,
						model: settings.model,
						embeddingVersion: settings.embeddingVersion,
						mediaModifiedAt: input.modifiedAt,
						extractedAt: new Date(),
						processingRevision: getCcipTaskRevision(input, settings),
					};
				},
				save: (_input, record, tx) => deps.vectorStore.upsert(record, tx),
				afterCommit: (input) =>
					deps.publishSourceEvent?.(input.mediaSourceId, "media-changed", {
						mediaId: input.mediaId,
						filePath: input.filePath,
					}),
			},
		);
	}

	async extract(
		mediaSourceId: string,
		mediaId: string,
		force = false,
		owner?: ProcessingOwner,
		request?: ProcessingRequestIdentity,
	): Promise<{ record: CcipVectorRecord; skipped: boolean }> {
		const media = await this.requireImage(mediaSourceId, mediaId);
		const input = await this.inputFor(media);
		const { response, reused } = await this.tasks.execute(
			input,
			owner,
			force,
			request,
		);
		return { record: response, skipped: reused };
	}

	requestExtraction(
		sourceId: string,
		mediaId: string,
		force = false,
		tx?: Transaction,
	) {
		return this.tasks.requestForMedia(sourceId, mediaId, force, tx);
	}
	reserveForJob(
		owner: ProcessingOwner,
		sourceId: string,
		mediaIds: string[],
		force = false,
	) {
		return this.tasks.reserveForJob(owner, sourceId, mediaIds, force);
	}
	runTask() {
		return this.tasks.runOnce();
	}
	reconcileTasks() {
		return this.tasks.reconcile();
	}

	async extractBatch(
		mediaSourceId: string,
		mediaIds: string[],
		force = false,
		concurrency = 1,
		owner?: ProcessingOwner,
		requests?: Record<string, ProcessingRequestIdentity>,
	) {
		if (!Number.isSafeInteger(concurrency) || concurrency < 1)
			throw new Error("concurrency must be a positive integer");
		return asyncPool(mediaIds, concurrency, async (mediaId) => ({
			mediaId,
			...(await this.extract(
				mediaSourceId,
				mediaId,
				force,
				owner,
				requests?.[mediaId],
			)),
		}));
	}

	async getStatus(
		mediaSourceId: string,
		mediaId: string,
	): Promise<CcipVectorStatus> {
		const media = await this.requireImage(mediaSourceId, mediaId);
		const input = await this.inputFor(media);
		const revision = getCcipTaskRevision(input, this.deps.getCcipSettings());
		const state = (
			await this.deps.processingStateRepo.findByMediaIds([mediaId])
		).find(
			(entry) =>
				entry.taskKind === "ccip" && entry.requestedRevision === revision,
		);
		if (state?.status === "failed")
			return {
				status: "failed",
				jobId: state.ownerJobId ?? undefined,
				error: "CCIP vector extraction failed",
			};
		if (
			state?.executionMode === "scheduled" &&
			(state.status === "pending" || state.status === "in_progress")
		)
			return { status: "processing" };
		const record = await this.deps.vectorStore.get(
			mediaId,
			this.currentVectorQuery(),
		);
		if (!record) return { status: "missing" };
		return {
			status:
				state?.status === "completed" &&
				state.completedRevision === revision &&
				record.processingRevision === revision
					? "ready"
					: "stale",
			model: record.model,
			extractedAt: record.extractedAt,
		};
	}

	private async inputFor(media: Media): Promise<MediaProcessingInput> {
		const source = await this.deps.sourceRepository.findById(
			media.mediaSourceId,
		);
		if (source?.type !== "local") throw new Error("Local source not found");
		return {
			mediaId: media.id,
			mediaSourceId: media.mediaSourceId,
			mediaType: media.mediaType,
			sourcePath: localConnectionSchema.parse(source.connectionInfo).path,
			filePath: media.filePath,
			modifiedAt: media.modifiedAt,
			fileSize: media.fileSize,
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
			!(await this.currentRecordIds([anchor], [anchorMedia])).has(anchorMediaId)
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
		const currentIds = await this.currentRecordIds(candidates, media);
		const currentCandidates = candidates.filter((candidate) =>
			currentIds.has(candidate.mediaId),
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

	private async currentRecordIds(
		records: CcipVectorRecord[],
		media: Media[],
	): Promise<Set<string>> {
		const states = await this.deps.processingStateRepo.findByMediaIds(
			media.map((item) => item.id),
		);
		const stateById = new Map(
			states
				.filter((state) => state.taskKind === "ccip")
				.map((state) => [state.mediaId, state]),
		);
		const sources = new Map(
			await Promise.all(
				[...new Set(media.map((item) => item.mediaSourceId))].map(
					async (id) =>
						[id, await this.deps.sourceRepository.findById(id)] as const,
				),
			),
		);
		const recordsById = new Map(
			records.map((record) => [record.mediaId, record]),
		);
		const settings = this.deps.getCcipSettings();
		const ids = new Set<string>();
		for (const item of media) {
			const source = sources.get(item.mediaSourceId);
			const connection = localConnectionSchema.safeParse(
				source?.connectionInfo,
			);
			if (
				item.mediaType !== "image" ||
				source?.type !== "local" ||
				!connection.success
			)
				continue;
			const revision = getCcipTaskRevision(
				{
					mediaId: item.id,
					mediaSourceId: item.mediaSourceId,
					mediaType: item.mediaType,
					sourcePath: connection.data.path,
					filePath: item.filePath,
					modifiedAt: item.modifiedAt,
					fileSize: item.fileSize,
				},
				settings,
			);
			const state = stateById.get(item.id);
			const record = recordsById.get(item.id);
			if (
				state?.status === "completed" &&
				state.requestedRevision === revision &&
				state.completedRevision === revision &&
				record?.processingRevision === revision &&
				record.model === settings.model &&
				record.embeddingVersion === settings.embeddingVersion
			)
				ids.add(item.id);
		}
		return ids;
	}

	private currentVectorQuery() {
		const settings = this.deps.getCcipSettings();
		return {
			model: settings.model,
			embeddingVersion: settings.embeddingVersion,
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

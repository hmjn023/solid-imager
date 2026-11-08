import { ResourceNotFoundError } from "@solid-imager/core/errors";
import {
	relatedMediaRequestSchema,
	type Media,
	type MediaReader,
	type MediaRelatedReader,
	type MediaSafe,
	type RelatedMediaItem,
	type RelatedMediaReason,
	type RelatedMediaRequestInput,
	type RelatedMediaResponse,
} from "@solid-imager/core/media";
import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
} from "@solid-imager/core/search";
import type { IEmbeddingStore } from "../ports/embedding-store";
import type { ILogger } from "../ports/logger";
import {
	sampleRelatedMedia,
	type RecommendationCandidate,
} from "./related-media-sampling";

type SimilarCandidates = {
	media: Media[];
	weights: Map<string, number>;
	status: RelatedMediaResponse["similarityStatus"];
};

function toSafeMedia(media: Media): MediaSafe {
	return {
		id: media.id,
		mediaSourceId: media.mediaSourceId,
		fileName: media.fileName,
		mediaType: media.mediaType,
		width: media.width,
		height: media.height,
		fileSize: media.fileSize,
		description: media.description,
		createdAt: media.createdAt,
		modifiedAt: media.modifiedAt,
		indexedAt: media.indexedAt,
		status: media.status,
	};
}

/** Read-only recommendations: viewing a detail never starts image inference. */
export class RelatedMediaService {
	constructor(
		private readonly deps: {
			mediaRepository: Pick<MediaReader, "findById" | "findByIds"> &
				MediaRelatedReader;
			embeddingStore: Pick<IEmbeddingStore, "get" | "search">;
			logger: Pick<ILogger, "warn">;
		},
	) {}

	/**
	 * Builds bounded category results and samples recommendations from a wider pool.
	 * Category reasons preserve each tab's limit and visual order; sampled results
	 * retain every matching reason from the full candidate pool.
	 */
	async getRelated(
		input: RelatedMediaRequestInput,
	): Promise<RelatedMediaResponse> {
		const { sourceId, mediaId, limit, seed } =
			relatedMediaRequestSchema.parse(input);
		const anchor = await this.deps.mediaRepository.findById(mediaId);
		if (
			!anchor ||
			anchor.mediaSourceId !== sourceId ||
			anchor.status !== "active"
		) {
			throw new ResourceNotFoundError("Media", mediaId);
		}

		// Fetch more than the displayed count so refresh can change membership too.
		const candidateLimit = Math.max(96, limit * 8);
		const [similar, characters, ips, tags] = await Promise.all([
			this.findSimilar(anchor, candidateLimit),
			this.deps.mediaRepository.findRelatedByRelation(
				mediaId,
				"character",
				candidateLimit,
				seed,
			),
			this.deps.mediaRepository.findRelatedByRelation(
				mediaId,
				"ip",
				candidateLimit,
				seed,
			),
			this.deps.mediaRepository.findRelatedByTags(
				mediaId,
				candidateLimit,
				seed,
			),
		]);
		const tagWeights = new Map(
			tags.map((candidate) => [candidate.media.id, candidate.score]),
		);
		const groups: Array<{
			reason: RelatedMediaReason;
			media: Media[];
			weight: (id: string) => number;
		}> = [
			{
				reason: "similar",
				media: similar.media,
				weight: (id) => similar.weights.get(id) ?? 0,
			},
			{ reason: "character", media: characters, weight: () => 3.5 },
			{ reason: "ip", media: ips, weight: () => 1.5 },
			{
				reason: "tag",
				media: tags.map((candidate) => candidate.media),
				weight: (id) => 4 * (tagWeights.get(id) ?? 0),
			},
		];
		const candidates = new Map<string, RecommendationCandidate>();
		const categoryItems = new Map<string, RelatedMediaItem>();
		const uniqueGroups = groups.map((group) => {
			const seen = new Set<string>();
			const unique: RelatedMediaItem[] = [];
			let categoryCount = 0;
			for (const media of group.media.slice(0, candidateLimit)) {
				if (
					media.id === mediaId ||
					media.status !== "active" ||
					(media.mediaType !== "image" &&
						!(group.reason === "similar" && media.mediaType === "video")) ||
					seen.has(media.id)
				)
					continue;
				seen.add(media.id);
				const weight = group.weight(media.id);
				if (!Number.isFinite(weight) || weight <= 0) continue;
				const existing = candidates.get(media.id);
				if (existing) {
					existing.item.reasons.push(group.reason);
					existing.weight += weight;
				} else {
					candidates.set(media.id, {
						item: { media: toSafeMedia(media), reasons: [group.reason] },
						weight,
					});
				}
				// Only category members get a category reason. Full-pool reasons on this
				// array would exceed category limits and disturb the visual ranking.
				if (categoryCount >= limit) continue;
				categoryCount += 1;
				const categoryItem = categoryItems.get(media.id);
				if (categoryItem) {
					categoryItem.reasons.push(group.reason);
				} else {
					const item = { media: toSafeMedia(media), reasons: [group.reason] };
					categoryItems.set(media.id, item);
					unique.push(item);
				}
			}
			return unique;
		});
		const items: RelatedMediaItem[] = [];
		// Process similar images first, preserving their original relative order.
		for (let index = 0; index < limit; index += 1) {
			for (const group of uniqueGroups) {
				const item = group[index];
				if (item) items.push(item);
			}
		}
		const signals =
			candidates.size > 0
				? await this.deps.mediaRepository.getRelatedMediaSignals([
						...candidates.keys(),
					])
				: [];
		return {
			items,
			recommendations: sampleRelatedMedia(
				[...candidates.values()],
				signals,
				limit,
				`${mediaId}:${seed}`,
			),
			similarityStatus: similar.status,
		};
	}

	/**
	 * Reads only a current, compatible embedding and preserves its search order.
	 * Missing or failed vector searches leave metadata-based recommendations usable.
	 */
	private async findSimilar(
		anchor: Media,
		limit: number,
	): Promise<SimilarCandidates> {
		if (anchor.mediaType !== "image" && anchor.mediaType !== "video") {
			return { media: [], weights: new Map(), status: "not_indexed" };
		}
		try {
			const embedding = await this.deps.embeddingStore.get(anchor.id);
			if (
				!embedding ||
				embedding.model !== EMBEDDING_GEMMA_MODEL ||
				embedding.version !== EMBEDDING_GEMMA_VERSION ||
				embedding.mediaModifiedAt.getTime() !== anchor.modifiedAt.getTime()
			) {
				return { media: [], weights: new Map(), status: "not_indexed" };
			}
			const result = await this.deps.embeddingStore.search(embedding.vector, {
				excludeMediaId: anchor.id,
				activeOnly: true,
				limit,
				offset: 0,
			});
			const media = await this.deps.mediaRepository.findByIds(
				result.candidates.map((candidate) => candidate.mediaId),
			);
			const byId = new Map(media.map((item) => [item.id, item]));
			return {
				weights: new Map(
					result.candidates.map((candidate, index) => [
						candidate.mediaId,
						// Cosine strength supplies relevance; rank gently favors the closest
						// images without removing the tail from the candidate pool.
						5 *
							Math.max(0, 1 - candidate.cosineDistance) *
							(0.5 + 0.5 / (1 + index / 12)),
					]),
				),
				media: result.candidates.flatMap((candidate) => {
					const item = byId.get(candidate.mediaId);
					return item ? [item] : [];
				}),
				status: "available",
			};
		} catch (error) {
			this.deps.logger.warn(
				{ err: error, mediaId: anchor.id },
				"Related media image similarity is unavailable",
			);
			return { media: [], weights: new Map(), status: "unavailable" };
		}
	}
}

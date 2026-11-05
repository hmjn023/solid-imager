import type {
	RelatedMediaItem,
	RelatedMediaSignals,
} from "@solid-imager/core/media";

export type RecommendationCandidate = {
	item: RelatedMediaItem;
	weight: number;
};

/** Stable non-cryptographic randomness keeps a viewed recommendation set repeatable. */
function seededRandom(seed: string): () => number {
	let state = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
	}
	return () => {
		state += 0x6d2b79f5;
		let value = Math.imul(state ^ (state >>> 15), state | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

/** Requires enough positive tags before overlap can justify a diversity penalty. */
function nearIdenticalTags(left: Set<string>, right: Set<string>): boolean {
	if (left.size < 4 || right.size < 4) return false;
	let intersection = 0;
	for (const tagId of left) {
		if (right.has(tagId)) intersection += 1;
	}
	return intersection / (left.size + right.size - intersection) >= 0.85;
}

/** Sample without replacement, reducing repeated authors and near-identical tag sets. */
export function sampleRelatedMedia(
	candidates: RecommendationCandidate[],
	signals: RelatedMediaSignals[],
	limit: number,
	seed: string,
): RelatedMediaItem[] {
	const random = seededRandom(seed);
	const byId = new Map(
		signals.map((signal) => [
			signal.mediaId,
			{ ...signal, tags: new Set(signal.tagIds) },
		]),
	);
	const remaining = candidates
		.filter(
			(candidate) => Number.isFinite(candidate.weight) && candidate.weight > 0,
		)
		.sort((left, right) =>
			left.item.media.id.localeCompare(right.item.media.id),
		);
	const selected: RelatedMediaItem[] = [];
	const authorCounts = new Map<string, number>();
	const selectedTags: Set<string>[] = [];
	while (selected.length < limit && remaining.length > 0) {
		const weights = remaining.map((candidate) => {
			const signal = byId.get(candidate.item.media.id);
			if (!signal) return candidate.weight;
			const authorCount = Math.max(
				0,
				...signal.authorIds.map((id) => authorCounts.get(id) ?? 0),
			);
			const repeatedTags = selectedTags.some((tags) =>
				nearIdenticalTags(tags, signal.tags),
			);
			// Soft penalties preserve a useful result even for single-author collections.
			return (candidate.weight / (1 + authorCount)) * (repeatedTags ? 0.3 : 1);
		});
		let draw = random() * weights.reduce((sum, weight) => sum + weight, 0);
		let chosenIndex = weights.length - 1;
		for (let index = 0; index < weights.length; index += 1) {
			draw -= weights[index];
			if (draw < 0) {
				chosenIndex = index;
				break;
			}
		}
		const [chosen] = remaining.splice(chosenIndex, 1);
		selected.push(chosen.item);
		const signal = byId.get(chosen.item.media.id);
		if (signal) {
			for (const authorId of new Set(signal.authorIds)) {
				authorCounts.set(authorId, (authorCounts.get(authorId) ?? 0) + 1);
			}
			selectedTags.push(signal.tags);
		}
	}
	return selected;
}

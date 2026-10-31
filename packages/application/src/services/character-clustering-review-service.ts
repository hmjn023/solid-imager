import {
	clusteringGroupsRequestSchema,
	clusteringMediaRequestSchema,
	type ClusteringGroup,
	type ClusteringGroupsRequest,
	type ClusteringMediaRequest,
	type ClusteringReviewMedia,
} from "@solid-imager/core/domain/characters/schemas";
import { ValidationError } from "@solid-imager/core/domain/errors";
import type {
	ICharacterClusteringResultsStore,
	StoredClusteringMedia,
} from "../ports/character-clustering-results-store";

export class CharacterClusteringReviewService {
	constructor(private readonly store: ICharacterClusteringResultsStore) {}
	listRuns() {
		return this.store.listRuns();
	}

	private async context(runId: string, comparisonRunId?: string) {
		const [run, comparison] = await Promise.all([
			this.store.loadRun(runId),
			comparisonRunId ? this.store.loadRun(comparisonRunId) : null,
		]);
		if (comparison && comparison.summary.cohortId !== run.summary.cohortId)
			throw new ValidationError("同じ対象画像の解析結果を比較してください。");
		const compared = comparison
			? new Map(comparison.media.map((item) => [item.assignment.mediaId, item]))
			: null;
		const project = (item: StoredClusteringMedia): ClusteringReviewMedia => {
			const other = compared?.get(item.assignment.mediaId);
			const comparable =
				other &&
				other.assignment.embeddingId === item.assignment.embeddingId &&
				other.assignment.extractedAt === item.assignment.extractedAt;
			return {
				id: item.record.media_id,
				mediaSourceId: item.record.source_id,
				fileName: item.record.file_name,
				modifiedAt: item.record.modified_at,
				characters: item.record.characters,
				clusterId: item.assignment.clusterId,
				membershipStrength: item.assignment.membershipStrength,
				comparisonClusterId: comparable ? other.assignment.clusterId : null,
			};
		};
		return { run, comparison, project };
	}

	async listGroups(request: ClusteringGroupsRequest) {
		const input = clusteringGroupsRequestSchema.parse(request);
		const { run, comparison, project } = await this.context(
			input.runId,
			input.comparisonRunId,
		);
		const buckets = new Map<number, StoredClusteringMedia[]>();
		for (const item of run.media) {
			if (item.assignment.clusterId < 0) continue;
			const bucket = buckets.get(item.assignment.clusterId) ?? [];
			bucket.push(item);
			buckets.set(item.assignment.clusterId, bucket);
		}
		const query = input.query.trim().toLocaleLowerCase();
		const groups: ClusteringGroup[] = [];
		for (const [id, items] of buckets) {
			if (
				query &&
				!items.some((item) => matches(item, query)) &&
				String(id) !== query.replace(/^#/, "")
			)
				continue;
			const characters = new Map<
				string,
				{ id: string; name: string; count: number }
			>();
			let strength = 0;
			let minimumStrength = 1;
			let noise = 0;
			let missing = 0;
			const comparisonGroups = new Set<number>();
			for (const item of items) {
				strength += item.assignment.membershipStrength;
				minimumStrength = Math.min(
					minimumStrength,
					item.assignment.membershipStrength,
				);
				for (const character of item.record.characters) {
					const vote = characters.get(character.id) ?? {
						...character,
						count: 0,
					};
					vote.count++;
					characters.set(character.id, vote);
				}
				if (comparison) {
					const other = project(item).comparisonClusterId;
					if (other === null) missing++;
					else if (other < 0) noise++;
					else comparisonGroups.add(other);
				}
			}
			const sorted = items.toSorted(
				(a, b) =>
					b.assignment.membershipStrength - a.assignment.membershipStrength ||
					a.record.media_id.localeCompare(b.record.media_id),
			);
			const previewItems = [
				...sorted.slice(0, 3),
				...sorted.slice(Math.max(3, sorted.length - 3)),
			];
			groups.push({
				id,
				size: items.length,
				meanStrength: strength / items.length,
				minimumStrength,
				characters: [...characters.values()]
					.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
					.slice(0, 5),
				labelKinds: characters.size,
				previews: previewItems.map(project),
				comparison: comparison
					? { clusters: comparisonGroups.size, noise, missing }
					: null,
			});
		}
		groups.sort(
			(a, b) =>
				(input.sort === "mixed"
					? b.labelKinds - a.labelKinds
					: input.sort === "weak"
						? a.meanStrength - b.meanStrength
						: b.size - a.size) || a.id - b.id,
		);
		return {
			groups: groups.slice(input.offset, input.offset + input.limit),
			total: groups.length,
		};
	}

	async listMedia(request: ClusteringMediaRequest) {
		const input = clusteringMediaRequestSchema.parse(request);
		const { run, project } = await this.context(
			input.runId,
			input.comparisonRunId,
		);
		const query = input.query.trim().toLocaleLowerCase();
		const items = run.media.filter(
			(item) =>
				item.assignment.clusterId === input.clusterId &&
				(!query || matches(item, query)),
		);
		items.sort(
			(a, b) =>
				(input.order === "name"
					? a.record.file_name.localeCompare(b.record.file_name)
					: input.order === "strong"
						? b.assignment.membershipStrength - a.assignment.membershipStrength
						: a.assignment.membershipStrength -
							b.assignment.membershipStrength) ||
				a.record.media_id.localeCompare(b.record.media_id),
		);
		return {
			media: items.slice(input.offset, input.offset + input.limit).map(project),
			total: items.length,
		};
	}
}

function matches(item: StoredClusteringMedia, query: string): boolean {
	return (
		item.record.file_name.toLocaleLowerCase().includes(query) ||
		item.record.characters.some((character) =>
			character.name.toLocaleLowerCase().includes(query),
		)
	);
}

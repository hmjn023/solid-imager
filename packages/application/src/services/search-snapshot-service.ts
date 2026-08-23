import { createHash } from "node:crypto";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type { SearchSnapshotRepository } from "@solid-imager/core/domain/repositories/search-snapshot-repository";
import {
	type SearchSnapshot,
	type SearchSnapshotState,
	searchSnapshotStateSchema,
} from "@solid-imager/core/domain/search/history";
import type { ISearchSnapshotService } from "../ports/search-snapshot-service";

function stableSerialize(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableSerialize).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		const entries = Object.entries(value).sort(([left], [right]) =>
			left < right ? -1 : left > right ? 1 : 0,
		);
		return `{${entries
			.map(
				([key, entryValue]) =>
					`${JSON.stringify(key)}:${stableSerialize(entryValue)}`,
			)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

function fingerprintState(state: SearchSnapshotState): string {
	return createHash("sha256")
		.update(stableSerialize({ version: 1, state }))
		.digest("hex");
}

export function createSearchSnapshotService(
	repository: SearchSnapshotRepository,
): ISearchSnapshotService {
	return {
		async capture(input): Promise<SearchSnapshot> {
			const state = searchSnapshotStateSchema.parse(input);
			const fingerprint = fingerprintState(state);
			return repository.create({ fingerprint, state });
		},

		async get(id): Promise<SearchSnapshot> {
			const snapshot = await repository.get(id);
			if (!snapshot) {
				throw new ResourceNotFoundError("SearchSnapshot", id);
			}
			return snapshot;
		},
	};
}

export { fingerprintState, stableSerialize };

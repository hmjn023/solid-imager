import { fingerprintState } from "@solid-imager/application/services/search-snapshot-service";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type { SearchSnapshotRepository } from "@solid-imager/core/domain/repositories/search-snapshot-repository";
import {
	type SearchSnapshot,
	searchSnapshotStateSchema,
} from "@solid-imager/core/domain/search/history";
import { defaultState } from "@solid-imager/core/domain/search/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	SearchSnapshotService,
	setSearchSnapshotRepository,
} from "~/infrastructure/services/search-snapshot-service";

const snapshotState = searchSnapshotStateSchema.parse({
	...defaultState,
	activePresetId: undefined,
	offset: undefined,
	scrollY: undefined,
});

const snapshot: SearchSnapshot = {
	id: "11111111-1111-4111-8111-111111111111",
	version: 1,
	fingerprint: "fingerprint",
	state: snapshotState,
	createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

describe("SearchSnapshotService", () => {
	let repository: SearchSnapshotRepository;

	beforeEach(() => {
		repository = {
			get: vi.fn().mockResolvedValue(snapshot),
			getByFingerprint: vi.fn(),
			create: vi.fn().mockResolvedValue(snapshot),
		};
		setSearchSnapshotRepository(repository);
	});

	it("captures a validated state and delegates deduplication to the repository", async () => {
		const result = await SearchSnapshotService.capture(snapshotState);

		expect(result).toEqual(snapshot);
		expect(repository.create).toHaveBeenCalledWith({
			fingerprint: expect.any(String),
			state: snapshotState,
		});
	});

	it("generates the same fingerprint for equivalent object key order", async () => {
		await SearchSnapshotService.capture(snapshotState);
		const firstFingerprint = vi.mocked(repository.create).mock.calls[0]?.[0]
			.fingerprint;
		await SearchSnapshotService.capture({
			...snapshotState,
			selectedTags: [...snapshotState.selectedTags],
		});
		const secondFingerprint = vi.mocked(repository.create).mock.calls[1]?.[0]
			.fingerprint;

		expect(secondFingerprint).toBe(firstFingerprint);
	});

	it("generates the same fingerprint when state keys are inserted in a different order", () => {
		const reorderedState = {
			sortOrder: snapshotState.sortOrder,
			sortBy: snapshotState.sortBy,
			limit: snapshotState.limit,
			similarityTopK: snapshotState.similarityTopK,
			similarityAnchorMediaId: snapshotState.similarityAnchorMediaId,
			advancedCondition: snapshotState.advancedCondition,
			selectedAuthors: snapshotState.selectedAuthors,
			selectedCharacters: snapshotState.selectedCharacters,
			selectedIps: snapshotState.selectedIps,
			selectedProjects: snapshotState.selectedProjects,
			selectedSource: snapshotState.selectedSource,
			tagMode: snapshotState.tagMode,
			excludeTags: snapshotState.excludeTags,
			selectedTags: snapshotState.selectedTags,
			searchQuery: snapshotState.searchQuery,
			mode: snapshotState.mode,
		} satisfies typeof snapshotState;

		expect(Object.keys(reorderedState)).not.toEqual(Object.keys(snapshotState));
		expect(fingerprintState(reorderedState)).toBe(
			fingerprintState(snapshotState),
		);
	});

	it("throws a typed not-found error", async () => {
		vi.mocked(repository.get).mockResolvedValue(null);

		await expect(
			SearchSnapshotService.get("22222222-2222-4222-8222-222222222222"),
		).rejects.toThrow(ResourceNotFoundError);
	});
});

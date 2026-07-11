export type SearchResultsQueryKeyInput = {
	mode: "simple" | "pro" | "vector";
	sourceId: string | undefined;
	conditionKey: string;
	sort: string | undefined;
	order: "asc" | "desc";
	limit: number;
	similarityAnchorMediaId: string | null;
	similarityTopK: number;
};

export const searchQueryKeys = {
	all: () => ["searchResults"] as const,
	results: (input: SearchResultsQueryKeyInput) =>
		["searchResults", input] as const,
};

export type SourceMediaQueryKeyInput = {
	sourceId: string | undefined;
	conditionKey: string;
	sort: string | undefined;
	order: "asc" | "desc";
};

export const sourceMediaQueryKeys = {
	all: () => ["media"] as const,
	forSource: (sourceId: string | undefined) => ["media", sourceId] as const,
	results: (input: SourceMediaQueryKeyInput) =>
		["media", input.sourceId, input] as const,
};

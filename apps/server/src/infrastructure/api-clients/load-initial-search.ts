import {
	defaultState,
	getSearchConditionFromState,
} from "@solid-imager/core/search";
import {
	buildSearchResultsQueryOptions,
	buildSourceMediaResultsQueryOptions,
	type InitialSearchState,
	SEARCH_COLLECTION_PAGE_SIZE,
} from "@solid-imager/ui/search";
import { searchQueryKeys, sourceMediaQueryKeys } from "@solid-imager/ui/query";
import type { QueryClient } from "@tanstack/solid-query";
import { isServer } from "solid-js/web";
import { orpc } from "./orpc-client";
import { searchMedia, searchSemantic, searchSimilar } from "./search-api";

/** Resolves shareable search inputs before the document render and primes the route's query. */
export async function loadInitialSearch(
	queryClient: QueryClient,
	snapshotId?: string,
	sourceId?: string,
): Promise<InitialSearchState | undefined> {
	if (!isServer) return;

	const snapshot = snapshotId
		? await orpc.searchSnapshots.get({ id: snapshotId }).catch(() => undefined)
		: undefined;
	const state = { ...defaultState, ...snapshot?.state };
	const condition = getSearchConditionFromState(state);
	const input = {
		condition,
		conditionKey: JSON.stringify(condition ?? null),
		sort: state.sortBy,
		order: state.sortOrder,
		limit: SEARCH_COLLECTION_PAGE_SIZE,
		similarityAnchorMediaId: state.similarityAnchorMediaId,
		similarityModel: state.similarityModel,
		similarityTopK: state.similarityTopK,
		semanticQuery: state.semanticQuery,
		searchMedia,
		searchSemantic,
		searchSimilar,
	};
	const load = sourceId
		? queryClient.infiniteQuery(
				buildSourceMediaResultsQueryOptions({ ...input, sourceId }),
			)
		: queryClient.infiniteQuery(
				buildSearchResultsQueryOptions({
					...input,
					mode: state.mode,
					sourceId: state.selectedSource || undefined,
					limit: Math.max(state.limit, SEARCH_COLLECTION_PAGE_SIZE),
				}),
			);
	await load.catch(() => {
		// Keep the regular browser query and its retry UI available after a server error.
		queryClient.removeQueries({
			queryKey: sourceId
				? sourceMediaQueryKeys.forSource(sourceId)
				: searchQueryKeys.all(),
		});
	});
	return { state, snapshot };
}

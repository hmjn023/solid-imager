import { t } from "@solid-imager/i18n";
import type { SearchPageFilterData } from "../hooks/use-search-page";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { SearchComposerField } from "./search-composer-field";
import { createDebouncedSignal } from "../utils/debounce";

export type {
	SearchArrayKey,
	SearchSuggestion,
	SearchToken,
} from "./search-composer-utils";
export {
	getSearchComposerTokens,
	parseSimilarityAnchor,
	parseSimilarityTopK,
} from "./search-composer-utils";

import {
	getSearchComposerSuggestions,
	removeActiveSearchToken,
	type SearchSuggestion,
	type SearchToken,
} from "./search-composer-utils";

export type SearchComposerProps = {
	draft: string;
	filterData: SearchPageFilterData;
	onDraftChange: (value: string) => void;
	onRemoveToken: (token: SearchToken) => void;
	onSelectSuggestion: (suggestion: SearchSuggestion) => void;
	onSubmit: () => void;
	inputRef?: (element: HTMLInputElement) => void;
	tokens: SearchToken[];
};

function SearchTokenChip(props: {
	token: SearchToken;
	onRemove: (token: SearchToken) => void;
}) {
	return (
		<span
			class={`inline-flex min-h-11 max-w-52 items-center gap-1 rounded px-1.5 font-medium text-label-sm sm:h-6 sm:min-h-6 ${props.token.destructive ? "bg-muted text-destructive" : "bg-accent text-primary"}`}
		>
			<span class="truncate">
				{props.token.prefix}:{props.token.value}
			</span>
			<Show when={props.token.removable !== false}>
				<button
					aria-label={t("searchComposer.removeValueValue", {
						value0: String(props.token.prefix),
						value1: String(props.token.value),
					})}
					class="flex size-11 shrink-0 items-center justify-center rounded hover:bg-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-4"
					onClick={() => props.onRemove(props.token)}
					type="button"
				>
					×
				</button>
			</Show>
		</span>
	);
}

export function SearchComposer(props: SearchComposerProps) {
	const [suggestionDraft, setSuggestionDraft] = createDebouncedSignal("", 150);
	const [removedAnnouncement, setRemovedAnnouncement] = createSignal("");
	createEffect(
		() => props.draft,
		(draft) => {
			setSuggestionDraft(draft);
		},
	);
	const suggestions = createMemo(() => {
		if (!props.draft.trim() || suggestionDraft() !== props.draft) return [];
		return getSearchComposerSuggestions(
			suggestionDraft(),
			props.filterData,
			props.tokens,
		);
	});
	const visibleTokens = createMemo(() => props.tokens.slice(0, 4));
	const hiddenTokens = createMemo(() => props.tokens.slice(4));

	return (
		<SearchComposerField
			draft={props.draft}
			id="search-composer"
			label={t("searchComposer.searchMedia")}
			inputRef={props.inputRef}
			onDraftChange={props.onDraftChange}
			onEmptyBackspace={() => {
				const last = props.tokens.findLast(
					(token) => token.removable !== false,
				);
				if (!last) return;
				const wasHidden = hiddenTokens().includes(last);
				props.onRemoveToken(last);
				if (wasHidden) {
					setRemovedAnnouncement(
						t("searchComposer.removedFilterValueValue", {
							value0: String(last.prefix),
							value1: String(last.value),
						}),
					);
				}
			}}
			onSelect={(suggestion) => {
				props.onSelectSuggestion(suggestion);
				return { draft: removeActiveSearchToken(props.draft) };
			}}
			onSubmit={props.onSubmit}
			options={suggestions()}
			optionValue={(option) => `${option.key}:${option.value}`}
			placeholder={t("searchComposer.searchOrTextTagAuthorSimilarLimit100")}
			virtualized
		>
			<For each={visibleTokens()}>
				{(token) => (
					<SearchTokenChip onRemove={props.onRemoveToken} token={token} />
				)}
			</For>
			<Show when={hiddenTokens().length > 0}>
				<Popover placement="bottom-start">
					<PopoverTrigger
						aria-label={t("searchComposer.inspectMoreFilters")}
						as={Button}
						class="min-h-11 px-2 font-medium text-label-sm text-muted-foreground sm:h-6 sm:min-h-6"
						size="sm"
						type="button"
						variant="secondary"
					>
						{t("searchComposer.valueMore", {
							value0: String(hiddenTokens().length),
						})}
					</PopoverTrigger>
					<PopoverContent class="workspace-theme w-72 p-3 shadow-lg">
						<div class="space-y-2">
							<p class="font-medium text-xs text-foreground">
								{t("searchComposer.moreActiveFilters")}
							</p>
							<div class="flex flex-wrap gap-1.5">
								<For each={hiddenTokens()}>
									{(token) => (
										<SearchTokenChip
											onRemove={props.onRemoveToken}
											token={token}
										/>
									)}
								</For>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</Show>
			<output class="sr-only" aria-live="polite">
				{removedAnnouncement()}
			</output>
		</SearchComposerField>
	);
}

import { createEffect } from "solid-js";

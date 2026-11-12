import { t } from "@solid-imager/i18n";
import type { SearchPageFilterData } from "../hooks/use-search-page";
import { createEffect, createMemo, For, Show } from "solid-js";
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

export function SearchComposer(props: SearchComposerProps) {
	const [suggestionDraft, setSuggestionDraft] = createDebouncedSignal("", 150);
	createEffect(() => setSuggestionDraft(props.draft));
	const suggestions = createMemo(() =>
		suggestionDraft() === props.draft
			? getSearchComposerSuggestions(
					props.draft,
					props.filterData,
					props.tokens,
				)
			: [],
	);
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
				if (last) props.onRemoveToken(last);
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
			<For each={props.tokens.slice(0, 4)}>
				{(token) => (
					<span
						class={`inline-flex h-6 max-w-52 items-center gap-1 rounded px-1.5 font-medium text-label-sm ${token.destructive ? "bg-muted text-destructive" : "bg-accent text-primary"}`}
					>
						<span class="truncate">
							{token.prefix}:{token.value}
						</span>
						<Show when={token.removable !== false}>
							<button
								aria-label={t("searchComposer.removeValueValue", {
									value0: String(token.prefix),
									value1: String(token.value),
								})}
								class="flex size-4 shrink-0 items-center justify-center rounded hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => props.onRemoveToken(token)}
								type="button"
							>
								×
							</button>
						</Show>
					</span>
				)}
			</For>
			<Show when={props.tokens.length > 4}>
				<span class="inline-flex h-6 items-center rounded bg-muted px-2 font-medium text-label-sm text-muted-foreground">
					{t("searchComposer.valueMore", {
						value0: String(props.tokens.length - 4),
					})}
				</span>
			</Show>
		</SearchComposerField>
	);
}

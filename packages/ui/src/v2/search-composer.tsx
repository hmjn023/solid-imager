import Search from "lucide-solid/icons/search";
import type { JSX } from "solid-js";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
	Combobox,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	useComboboxContext,
	VirtualComboboxContent,
} from "../combobox";
import type { SearchPageFilterData } from "../hooks/use-search-page";
import { Label } from "../label";
import { createDebouncedSignal } from "../utils/debounce";

export type {
	SearchArrayKey,
	SearchSuggestion,
	SearchToken,
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

function ComposerInput(props: {
	draft: string;
	onDraftChange: (value: string) => void;
	onFocus: () => void;
	onKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent>;
	placeholder: string;
	ref?: (element: HTMLInputElement) => void;
}) {
	const context = useComboboxContext();
	createEffect(() => context.setInputValue(props.draft));

	return (
		<ComboboxInput
			aria-label="メディアを検索"
			class="h-7 min-h-7 min-w-40 flex-1 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
			enterkeyhint="search"
			id="v2-search-composer"
			onFocus={props.onFocus}
			onInput={(event) => props.onDraftChange(event.currentTarget.value)}
			onKeyDown={props.onKeyDown}
			placeholder={props.placeholder}
			ref={props.ref}
		/>
	);
}

export function SearchComposer(props: SearchComposerProps) {
	const [selectedSuggestion, setSelectedSuggestion] =
		createSignal<SearchSuggestion | null>(null);
	const [menuOpen, setMenuOpen] = createSignal(false);
	const [suggestionDraft, setSuggestionDraft] = createDebouncedSignal("", 150);
	const suggestions = createMemo(() =>
		getSearchComposerSuggestions(
			suggestionDraft(),
			props.filterData,
			props.tokens,
		),
	);

	const handleSelect = (suggestion: SearchSuggestion | null) => {
		if (!suggestion) return;
		props.onSelectSuggestion(suggestion);
		setSelectedSuggestion(suggestion);
		setMenuOpen(false);
		requestAnimationFrame(() => {
			setSelectedSuggestion(null);
			props.onDraftChange(removeActiveSearchToken(props.draft));
		});
	};

	const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (
		event,
	) => {
		if (event.key === "Backspace" && props.draft.length === 0) {
			const token = props.tokens[props.tokens.length - 1];
			if (token) {
				event.preventDefault();
				props.onRemoveToken(token);
				return;
			}
		}
		if (event.key === "Enter" && !(menuOpen() && suggestions().length > 0)) {
			event.preventDefault();
			props.onSubmit();
		}
	};

	return (
		<form
			autocomplete="off"
			class="relative min-w-[min(16rem,100%)] flex-1"
			onSubmit={(event) => {
				event.preventDefault();
				props.onSubmit();
			}}
		>
			<Label class="sr-only" for="v2-search-composer">
				メディアを検索
			</Label>
			<Search
				aria-hidden="true"
				class="absolute top-[0.7rem] left-3 z-10 text-[var(--v2-text-muted)]"
				size={16}
			/>
			<Combobox<SearchSuggestion>
				allowDuplicateSelectionEvents={false}
				closeOnSelection
				defaultFilter={() => true}
				disallowEmptySelection={false}
				itemComponent={(itemProps) => (
					<ComboboxItem item={itemProps.item}>
						<ComboboxItemLabel>
							{itemProps.item.rawValue.label}
						</ComboboxItemLabel>
					</ComboboxItem>
				)}
				onChange={handleSelect}
				onInputChange={(value) => {
					props.onDraftChange(value);
					setSuggestionDraft(value);
					setMenuOpen(true);
				}}
				onOpenChange={setMenuOpen}
				open={menuOpen() && suggestions().length > 0}
				optionLabel="label"
				optionTextValue="label"
				optionValue={(suggestion) => `${suggestion.key}:${suggestion.value}`}
				options={suggestions()}
				removeOnBackspace={false}
				triggerMode="input"
				value={selectedSuggestion()}
			>
				<ComboboxControl<SearchSuggestion>
					aria-label="メディアを検索"
					class="flex h-auto min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-[var(--v2-border-strong)] bg-white py-1 pr-8 pl-9 focus-within:ring-2 focus-within:ring-[var(--v2-focus)] focus-within:ring-offset-1 sm:min-h-9"
				>
					<For each={props.tokens.slice(0, 4)}>
						{(token) => (
							<span
								class={`inline-flex h-6 max-w-52 items-center gap-1 rounded px-1.5 font-medium text-[11px] ${token.destructive ? "bg-red-50 text-destructive" : "bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]"}`}
							>
								<span class="truncate">
									{token.prefix}:{token.value}
								</span>
								<button
									aria-label={`${token.prefix}:${token.value}を解除`}
									class="flex size-4 shrink-0 items-center justify-center rounded hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)]"
									onClick={() => props.onRemoveToken(token)}
									type="button"
								>
									×
								</button>
							</span>
						)}
					</For>
					<Show when={props.tokens.length > 4}>
						<span class="inline-flex h-6 items-center rounded bg-[var(--v2-surface-muted)] px-2 font-medium text-[11px] text-[var(--v2-text-secondary)]">
							ほか{props.tokens.length - 4}件
						</span>
					</Show>
					<ComposerInput
						draft={props.draft}
						onDraftChange={props.onDraftChange}
						onFocus={() => {
							if (suggestions().length > 0) setMenuOpen(true);
						}}
						onKeyDown={handleKeyDown}
						placeholder="検索、または tag: / author: / ip: …"
						ref={props.inputRef}
					/>
				</ComboboxControl>
				<VirtualComboboxContent class="v2-theme w-[min(28rem,calc(100dvw-1.5rem))] p-1 shadow-xl" />
			</Combobox>
			<kbd class="absolute top-2 right-2 rounded border border-[var(--v2-border)] bg-[var(--v2-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--v2-text-muted)]">
				/
			</kbd>
		</form>
	);
}

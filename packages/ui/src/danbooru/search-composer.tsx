import type { DanbooruTag } from "@solid-imager/core/danbooru";
import { createQuery } from "@tanstack/solid-query";
import {
	createEffect,
	createMemo,
	createSignal,
	Show,
	type JSX,
} from "solid-js";
import { Button } from "../button";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	useComboboxContext,
} from "../combobox";
import { createDebouncedSignal } from "../utils/debounce";
import {
	completeDanbooruTag,
	danbooruTagCategoryLabels,
	getDanbooruCompletion,
} from "./completion";

function SearchInput(props: {
	draft: string;
	inputRef: (element: HTMLInputElement) => void;
	onInput: (value: string, caret: number) => void;
	onCaretChange: (caret: number) => void;
	onEnter: () => boolean;
}) {
	const context = useComboboxContext();
	createEffect(() => context.setInputValue(props.draft));
	return (
		<ComboboxInput
			aria-label="Danbooru を検索"
			aria-describedby="danbooru-search-hint"
			class="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
			placeholder="タグを入力（例: landscape -monochrome）"
			ref={props.inputRef}
			onInput={
				((event) =>
					props.onInput(
						event.currentTarget.value,
						event.currentTarget.selectionStart ??
							event.currentTarget.value.length,
					)) satisfies JSX.EventHandler<HTMLInputElement, InputEvent>
			}
			onClick={
				((event) =>
					props.onCaretChange(
						event.currentTarget.selectionStart ?? props.draft.length,
					)) satisfies JSX.EventHandler<HTMLInputElement, MouseEvent>
			}
			onKeyUp={
				((event) =>
					props.onCaretChange(
						event.currentTarget.selectionStart ?? props.draft.length,
					)) satisfies JSX.EventHandler<HTMLInputElement, KeyboardEvent>
			}
			onKeyDown={(event) => {
				if (!event.isComposing && event.key === "Enter" && props.onEnter())
					event.preventDefault();
			}}
		/>
	);
}

export function DanbooruSearchComposer(props: {
	draft: string;
	onDraftChange: (value: string) => void;
	onSubmit: () => void;
	suggestTags: (query: string) => Promise<DanbooruTag[]>;
}) {
	let input: HTMLInputElement | undefined;
	let committing = false;
	const [caret, setCaret] = createSignal(props.draft.length);
	const [open, setOpen] = createSignal(false);
	const [selected, setSelected] = createSignal<DanbooruTag | null>(null);
	const [query, setQuery] = createDebouncedSignal("", 250);
	const token = createMemo(() => getDanbooruCompletion(props.draft, caret()));
	createEffect(() => setQuery(token().query));
	const suggestions = createQuery(() => ({
		queryKey: ["danbooru", "tags", query()],
		queryFn: () => props.suggestTags(query()),
		enabled: query().length > 0,
		staleTime: 300_000,
		retry: false,
	}));
	const options = () =>
		query() === token().query ? (suggestions.data ?? []) : [];
	const submit = () => {
		setOpen(false);
		props.onSubmit();
	};
	return (
		<form
			class="min-w-0 flex-1 space-y-1"
			autocomplete="off"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<div class="flex items-start gap-2">
				<Combobox<DanbooruTag>
					class="min-w-0 flex-1"
					options={options()}
					optionValue="name"
					optionTextValue="name"
					optionLabel="name"
					defaultFilter={() => true}
					triggerMode="input"
					value={selected()}
					open={open() && options().length > 0}
					onOpenChange={setOpen}
					allowDuplicateSelectionEvents
					closeOnSelection
					noResetInputOnBlur
					removeOnBackspace={false}
					onInputChange={(value) => {
						if (!committing) {
							props.onDraftChange(value);
							setOpen(true);
						}
					}}
					onChange={(tag) => {
						if (!tag) return;
						committing = true;
						const completion = token();
						const value = completeDanbooruTag(props.draft, caret(), tag.name);
						const position =
							completion.start + completion.prefix.length + tag.name.length + 1;
						setSelected(tag);
						setOpen(false);
						props.onDraftChange(value);
						setCaret(position);
						requestAnimationFrame(() => {
							setSelected(null);
							props.onDraftChange(value);
							input?.focus();
							input?.setSelectionRange(position, position);
							committing = false;
						});
					}}
					itemComponent={(item) => (
						<ComboboxItem item={item.item} class="gap-3">
							<ComboboxItemLabel class="min-w-0 truncate">
								{item.item.rawValue.name}
							</ComboboxItemLabel>
							<span class="shrink-0 text-muted-foreground text-xs">
								{danbooruTagCategoryLabels[item.item.rawValue.category] ??
									"タグ"}{" "}
								· {item.item.rawValue.postCount.toLocaleString()}
							</span>
						</ComboboxItem>
					)}
				>
					<ComboboxControl<DanbooruTag> class="flex min-w-0 rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
						<SearchInput
							draft={props.draft}
							inputRef={(element) => {
								input = element;
							}}
							onInput={(value, position) => {
								if (!committing) {
									props.onDraftChange(value);
									setCaret(position);
									setOpen(true);
								}
							}}
							onCaretChange={setCaret}
							onEnter={() => {
								if (open() && options().length > 0) return false;
								submit();
								return true;
							}}
						/>
					</ComboboxControl>
					<ComboboxContent class="workspace-theme w-popover-large max-w-viewport-gutter" />
				</Combobox>
				<Button type="submit">検索</Button>
			</div>
			<p class="text-muted-foreground text-xs" id="danbooru-search-hint">
				スペースで AND、-タグで除外。rating:g や order:score も使えます。
			</p>
			<Show when={open() && suggestions.isError && query() === token().query}>
				<output class="text-muted-foreground text-xs">
					タグ候補を取得できませんでした。タグを直接入力して検索できます。
				</output>
			</Show>
		</form>
	);
}

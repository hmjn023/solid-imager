import type { ViewerTag } from "@solid-imager/core/external-viewer";
import { createQuery } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal } from "solid-js";
import { createAppShortcut } from "../shortcuts/create-app-shortcut";
import { createDebouncedSignal } from "../utils/debounce";
import { SearchComposerField } from "../workspace/search-composer-field";
import {
	completeDanbooruTag,
	danbooruTagCategoryLabels,
	getDanbooruCompletion,
} from "./completion";

export function DanbooruSearchComposer(props: {
	provider?: "Danbooru" | "pixiv";
	draft: string;
	onDraftChange: (value: string) => void;
	onSubmit: () => void;
	suggestTags: (query: string) => Promise<ViewerTag[]>;
}) {
	let input: HTMLInputElement | undefined;
	createAppShortcut("focusSearch", () => input?.focus());
	const [caret, setCaret] = createSignal(props.draft.length);
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
	const options = createMemo(() => {
		// Reading pending query data suspends the route and detaches the focused input.
		if (!suggestions.isSuccess || query() !== token().query) return [];
		return (suggestions.data ?? []).map((tag) => ({
			label: tag.name,
			value: tag.name,
			description: [
				danbooruTagCategoryLabels[tag.category ?? -1] ?? "タグ",
				tag.postCount?.toLocaleString(),
			]
				.filter(Boolean)
				.join(" · "),
		}));
	});
	return (
		<SearchComposerField
			id="external-search-composer"
			label={(props.provider ?? "Danbooru") + " を検索"}
			draft={props.draft}
			inputRef={(element) => {
				input = element;
			}}
			onDraftChange={props.onDraftChange}
			onCaretChange={setCaret}
			onSelect={(option) => ({
				draft: completeDanbooruTag(props.draft, caret(), option.value),
				caret: token().start + token().prefix.length + option.value.length + 1,
			})}
			onSubmit={props.onSubmit}
			options={options()}
			placeholder="タグを入力（例: landscape -monochrome）"
			submitLabel="検索"
			hint={
				"スペースで AND、-タグで除外、~タグで OR。" +
				(props.provider === "pixiv"
					? "Danbooru タグを pixiv のタグに変換します。"
					: "rating:g や order:score も使えます。")
			}
			status={
				suggestions.isError && query() === token().query
					? "タグ候補を取得できませんでした。タグを直接入力して検索できます。"
					: undefined
			}
		/>
	);
}

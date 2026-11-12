import { t } from "@solid-imager/i18n";
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
				danbooruTagCategoryLabels[tag.category ?? -1] ??
					t("pixivArtworkDetail.tags"),
				tag.postCount?.toLocaleString(),
			]
				.filter(Boolean)
				.join(" · "),
		}));
	});
	return (
		<SearchComposerField
			id="external-search-composer"
			label={
				(props.provider ?? t("sidebar.danbooru")) + t("searchComposer.search")
			}
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
			placeholder={t("searchComposer.enterTagsEGLandscapeMonochrome")}
			submitLabel={t("actions.search")}
			hint={
				t("searchComposer.spaceForANDTagToExcludeTagForOR") +
				(props.provider === "pixiv"
					? t("searchComposer.convertsDanbooruTagsToPixivTags")
					: t("searchComposer.youCanAlsoUseRatingGAndOrderScore"))
			}
			status={
				suggestions.isError && query() === token().query
					? t("searchComposer.couldNotLoadTagSuggestionsYouCanStillEnter")
					: undefined
			}
		/>
	);
}

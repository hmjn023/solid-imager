import {
	clearPixivRelatedSnapshots,
	type PixivRelatedSnapshot,
} from "../external-viewer/pixiv-related-history";
import { t } from "@solid-imager/i18n";
import type { AppContractClient } from "@solid-imager/core/contract";
import type {
	PixivCard,
	PixivSearchResult,
} from "@solid-imager/core/external-viewer";
import { createQuery } from "@tanstack/solid-query";
import { Button } from "../button";
import { createEffect, For, on, Show } from "solid-js";
import { createViewerImports } from "../external-viewer/viewer-imports";
import {
	createPixivAccount,
	type ViewerFetch,
	type PixivClientFactory,
	PixivAccountDialog,
} from "../external-viewer/pixiv-account";
import { PixivRelatedWorks } from "../external-viewer/pixiv-related-works";
import { PixivArtworkDetail } from "../external-viewer/pixiv-artwork-detail";
import { createPixivViewingHistory } from "../external-viewer/pixiv-viewing-history";
import { PixivViewingHistoryDialog } from "../external-viewer/pixiv-viewing-history-dialog";
import { createPixivSearchHistory } from "../external-viewer/viewer-search-history";
import { ViewerSearchHistoryDialog } from "../external-viewer/viewer-search-history-dialog";
import { pixivImageHref } from "../external-viewer/post-media";
import {
	createViewerSearch,
	type PixivCollection,
} from "../external-viewer/use-viewer-search";
import { PixivBookmarkFilters } from "../external-viewer/pixiv-bookmark-filters";
import { PixivBookmarkAction } from "../external-viewer/pixiv-bookmark-action";
import {
	ViewerWorkspace,
	type ViewerNavigation,
} from "../external-viewer/workspace";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";

type PixivProps = ViewerNavigation & {
	client: Pick<AppContractClient, "viewer" | "imports">;
	apiBase: () => string;
	fetch?: ViewerFetch;
	createViewer: PixivClientFactory;
	openPixivLogin?: () => Promise<void>;
};

function feedOptions() {
	return [
		{ value: "daily" as const, label: t("pixivScreen.dailyRanking") },
		{ value: "weekly" as const, label: t("pixivScreen.weeklyRanking") },
		{ value: "monthly" as const, label: t("pixivScreen.monthlyRanking") },
		{ value: "rookie" as const, label: t("pixivScreen.rookieRanking") },
		{ value: "follow" as const, label: t("pixivScreen.followLatest") },
		{ value: "bookmarks" as const, label: t("pixivBookmarks.title") },
	];
}
function PixivSearchInfo(props: {
	feed: PixivCollection;
	data: PixivSearchResult;
	onChoose: (tag: string, value: string) => void;
}) {
	return (
		<div class="mb-3 space-y-2">
			<p class="text-muted-foreground text-sm" aria-live="polite">
				{props.data.word
					? t("pixivScreen.pixivSearch") + props.data.word
					: feedOptions().find((option) => option.value === props.feed)?.label}
			</p>
			<For each={props.data.mappings.filter((row) => row.names.length > 1)}>
				{(row) => (
					<div class="flex min-w-0 items-center gap-2">
						<span class="truncate text-sm">{row.tag}</span>
						<Select
							options={row.names}
							value={row.selected}
							onChange={(value) => {
								if (value) props.onChoose(row.tag, value);
							}}
							itemComponent={(item) => (
								<SelectItem item={item.item}>{item.item.rawValue}</SelectItem>
							)}
						>
							<SelectTrigger aria-label={row.tag + t("pixivScreen.pixivTags")}>
								<SelectValue<string>>
									{(state) => state.selectedOption()}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>
				)}
			</For>
		</div>
	);
}
export function PixivScreen(props: PixivProps) {
	const account = createPixivAccount(
		props.apiBase(),
		props.createViewer,
		props.fetch,
	);
	const historyScope = () =>
		account.ready()
			? JSON.stringify([props.apiBase(), account.session()?.userId ?? "guest"])
			: undefined;
	const searchHistory = createPixivSearchHistory(historyScope);
	const browse = createViewerSearch<PixivSearchResult>(
		"pixiv",
		async (input, choices, literalPixivTag, pixivUserId, bookmark) => {
			const viewer = account.transport().viewer;
			if (bookmark)
				return viewer.pixivBookmarks({ ...bookmark, page: input.page });
			const result = await viewer.search({
				...input,
				provider: "pixiv",
				literalPixivTag,
				pixivUserId,
				choices,
			});
			if (result.provider !== "pixiv")
				throw new Error(t("pixivScreen.searchDestinationDoesNotMatch"));
			return result;
		},
		account,
		() => props.selectedPostId,
		searchHistory.record,
	);
	const relatedHistory = new Map<string, PixivRelatedSnapshot>();
	createEffect(
		on(
			() => (account.ready() ? JSON.stringify(account.scope()) : undefined),
			(scope, previous) => {
				if (previous && previous !== scope) {
					relatedHistory.clear();
					clearPixivRelatedSnapshots();
					if (!account.session() && browse.pixivFeed() === "follow")
						browse.selectFeed("daily");
				}
			},
		),
	);
	const imports = createViewerImports((items) =>
		props.client.imports.bulkAdd({ items }),
	);
	const detail = createQuery(() => ({
		queryKey: ["pixiv", "artwork", props.selectedPostId, ...account.scope()],
		queryFn: () =>
			account
				.transport()
				.viewer.pixivArtwork({ id: props.selectedPostId ?? 0 }),
		enabled: account.ready() && !!props.selectedPostId,
		gcTime: 0,
		retry: false,
		staleTime: 30_000,
	}));
	const history = createPixivViewingHistory(historyScope);
	createEffect(
		on(
			() => {
				const id = props.selectedPostId;
				return account.ready() && detail.isSuccess && detail.data?.id === id
					? id
					: undefined;
			},
			(id, previous) => {
				if (id && id !== previous && detail.data) history.record(detail.data);
			},
		),
	);
	const describePost = (post: PixivCard) => ({
		title:
			post.title || t("pixivScreen.pixivValue", { value0: String(post.id) }),
		thumbnail:
			post.thumbnail && pixivImageHref(props.apiBase(), post.thumbnail),
		info: [post.author, t("pixivScreen.imageCount", { count: post.pageCount })]
			.filter(Boolean)
			.join(" · "),
	});
	const renderHistory = () => (
		<PixivViewingHistoryDialog
			ready={account.ready()}
			posts={history.posts()}
			describePost={describePost}
			postHref={props.postHref}
			onOpenPost={(id) => {
				if (id !== props.selectedPostId) {
					browse.rememberScroll();
					props.onOpenPost(id);
				}
			}}
			onClear={history.clear}
		/>
	);
	return (
		<ViewerWorkspace
			{...props}
			providerName="pixiv"
			siteUrl="https://www.pixiv.net"
			browse={browse}
			suggestTags={(query) => props.client.viewer.suggestTags({ query })}
			errorTitle={t("pixivScreen.couldNotSearchPixiv")}
			emptyTitle={t("pixivScreen.noMatchingWorks")}
			actions={
				<div class="flex min-w-0 flex-wrap items-center gap-2">
					<Select
						options={feedOptions()}
						optionValue="value"
						optionTextValue="label"
						optionDisabled={(option) =>
							(option.value === "follow" || option.value === "bookmarks") &&
							!account.session()
						}
						value={feedOptions().find(
							(option) => option.value === browse.pixivFeed(),
						)}
						onChange={(option) => {
							if (option) browse.selectFeed(option.value);
						}}
						itemComponent={(item) => (
							<SelectItem item={item.item}>
								{item.item.rawValue.label}
							</SelectItem>
						)}
					>
						<SelectTrigger
							class="w-full sm:w-auto"
							aria-label={t("pixivScreen.feed")}
						>
							<SelectValue<ReturnType<typeof feedOptions>[number]>>
								{(state) => state.selectedOption()?.label}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
					<Show when={browse.showingBookmarks() && account.session()}>
						<PixivBookmarkFilters
							filter={browse.bookmarkFilter()}
							scope={account.scope()}
							loadTags={(visibility) =>
								account.transport().viewer.pixivBookmarkTags({ visibility })
							}
							onChange={browse.selectBookmarkFilter}
						/>
					</Show>
					{renderHistory()}
					<ViewerSearchHistoryDialog
						ready={account.ready()}
						entries={searchHistory.entries()}
						onSelect={browse.restoreSearch}
						onClear={searchHistory.clear}
					/>
					<PixivAccountDialog
						account={account}
						openPixivLogin={props.openPixivLogin}
					/>
					<Show when={!account.session()}>
						<p class="text-xs text-muted-foreground">
							{t("pixivScreen.followLogin")}
						</p>
					</Show>
				</div>
			}
			renderSearchInfo={(data) => (
				<Show
					when={browse.author()}
					fallback={
						<PixivSearchInfo
							data={data}
							feed={browse.pixivFeed()}
							onChoose={browse.choose}
						/>
					}
				>
					{(author) => (
						<div class="mb-3 flex flex-wrap items-center gap-2">
							<p class="text-sm" aria-live="polite">
								{t("pixivScreen.authorWorks", { name: author().name })}
							</p>
							<Button variant="outline" onClick={() => browse.submit("")}>
								{t("pixivScreen.clearAuthor")}
							</Button>
						</div>
					)}
				</Show>
			)}
			describePost={describePost}
			renderDetail={(navigation) => (
				<PixivArtworkDetail
					{...navigation}
					query={detail}
					imports={imports}
					historyAction={renderHistory()}
					bookmarkAction={(id, title) => (
						<Show when={account.session()} keyed>
							{(session) => (
								<PixivBookmarkAction
									id={id}
									title={title}
									scope={account.scope()}
									load={(id) =>
										account.transport().viewer.pixivBookmarkState({ id })
									}
									save={async (change) => {
										const result = await account
											.transport()
											.viewer.setPixivBookmark(change);
										if (
											account.session() === session &&
											browse.showingBookmarks()
										)
											void browse.results.refetch();
										return result;
									}}
								/>
							)}
						</Show>
					)}
					related={(id) => (
						<PixivRelatedWorks
							postId={id}
							history={relatedHistory}
							scope={account.scope()}
							enabled={account.ready()}
							apiBase={props.apiBase()}
							load={(id, ids) =>
								account.transport().viewer.pixivRelatedPage({ id, ids })
							}
							postHref={props.postHref}
							onOpenPost={(id) => props.onOpenPost(id)}
						/>
					)}
					onOpenAuthor={(id, name) => {
						browse.openAuthor(id, name);
						props.onClosePost();
					}}
					onSearchTag={(tag) => {
						browse.submit(tag, true);
						props.onClosePost();
					}}
					apiBase={props.apiBase}
					readingScope={account.scope()}
					animation={(id) => account.transport().animation(id)}
				/>
			)}
		/>
	);
}
